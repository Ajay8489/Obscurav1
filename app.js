import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs, Timestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyBB9ItIgTVpq9KyoyNpCzs-A4kxZ0e55bk",
    authDomain: "experiment-51058.firebaseapp.com",
    projectId: "experiment-51058",
    storageBucket: "experiment-51058.firebasestorage.app",
    messagingSenderId: "523094266784",
    appId: "1:523094266784:web:e370716bfbd4a27555cac5",
    measurementId: "G-SHLW7HC5E4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- DOM ELEMENTS ---
const spareForm = document.getElementById('spareForm');
const formTitle = document.getElementById('formTitle');
const spareNameInput = document.getElementById('spareName');
const spareQtyInput = document.getElementById('spareQty');
const spareUsedInput = document.getElementById('spareUsed');
const spareBarcodeInput = document.getElementById('spareBarcode');
const barcodePreview = document.getElementById('barcodePreview');
const editIdInput = document.getElementById('editId');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const logoutBtn = document.getElementById('logoutBtn');
const printDbBtn = document.getElementById('printDbBtn');
const inventoryTableBody = document.getElementById('inventoryTableBody');
const totalUniqueEl = document.getElementById('totalUnique');
const totalQtyEl = document.getElementById('totalQty');
const generateBarcodeBtn = document.getElementById('generateBarcodeBtn');
const printBarcodeBtn = document.getElementById('printBarcodeBtn');

// --- USAGE TRACKER DOM ELEMENTS ---
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const checkUsageBtn = document.getElementById('checkUsageBtn');
const usageResults = document.getElementById('usageResults');
const usageList = document.getElementById('usageList');

// --- CACHED INVENTORY DATA FOR USAGE FILTERING ---
let currentInventoryData = [];

// --- AUTHENTICATION & INITIALIZATION ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log("Authenticated as:", user.uid);
    } else {
        signInAnonymously(auth).catch((error) => {
            console.error("Anonymous auth error:", error);
        });
    }
});

// Load inventory immediately
initInventoryListener();

// Set default dates for usage tracker on load
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    if (endDateInput) endDateInput.value = today;
    if (startDateInput) startDateInput.value = today;
});

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('currentUser');
        signOut(auth).then(() => {
            window.location.href = 'index.html';
        }).catch((error) => {
            console.error("Logout error:", error);
        });
    });
}

// --- REAL-TIME FIRESTORE LISTENER ---
function initInventoryListener() {
    const q = collection(db, "spare");
    onSnapshot(q, (snapshot) => {
        let totalUnique = snapshot.size;
        let totalQty = 0;
        currentInventoryData = []; // Reset cache array

        if (inventoryTableBody) {
            inventoryTableBody.innerHTML = "";
            if (totalUnique === 0) {
                inventoryTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">No spares found in inventory.</td></tr>`;
            }
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const rawName = data.name || "";
            const rawBarcode = data.barcode || "";
            const qty = Number(data.quantity) || 0;
            // Safely handle records that don't have the 'used' field yet
            const used = (data.used !== undefined && data.used !== null) ? Number(data.used) : 0;
            
            // Push into local cache for date range filtering
            currentInventoryData.push({
                id,
                name: rawName,
                quantity: qty,
                used: used,
                barcode: rawBarcode,
                updatedAt: data.updatedAt || data.createdAt
            });

            totalQty += qty;

            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 transition-colors";
            
            row.innerHTML = `
                <td class="p-4 font-medium text-gray-800">${escapeHtml(rawName)}</td>
                <td class="p-4 font-mono text-gray-600">${escapeHtml(rawBarcode)}</td>
                <td class="p-4 text-center font-semibold text-gray-700">${qty}</td>
                <td class="p-4 text-center font-semibold text-orange-600">${used}</td>
                <td class="p-4 text-right space-x-2">
                    <button type="button" class="edit-btn text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded">Edit</button>
                    <button type="button" class="delete-btn text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded">Delete</button>
                </td>
            `;

            const editBtn = row.querySelector('.edit-btn');
            if (editBtn) {
                editBtn.addEventListener('click', () => {
                    window.editSpare(id, rawName, qty, rawBarcode, used);
                });
            }

            const deleteBtn = row.querySelector('.delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                    window.deleteSpare(id);
                });
            }

            if (inventoryTableBody) {
                inventoryTableBody.appendChild(row);
            }
        });

        if (totalUniqueEl) totalUniqueEl.textContent = totalUnique;
        if (totalQtyEl) totalQtyEl.textContent = totalQty;
    }, (error) => {
        console.error("Error fetching inventory: ", error);
        if (inventoryTableBody) {
            inventoryTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-red-500">Error loading inventory data.</td></tr>`;
        }
    });
}

// --- USAGE TRACKER FILTER HANDLER ---
if (checkUsageBtn) {
    checkUsageBtn.addEventListener('click', () => {
        const startVal = startDateInput ? startDateInput.value : '';
        const endVal = endDateInput ? endDateInput.value : '';

        if (!startVal || !endVal) {
            alert("Please select both a start and end date.");
            return;
        }

        const startDate = new Date(startVal);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(endVal);
        endDate.setHours(23, 59, 59, 999);

        const filteredSpares = currentInventoryData.filter(item => {
            if (item.used <= 0) return false;
            
            let itemDate = new Date();
            if (item.updatedAt) {
                itemDate = typeof item.updatedAt.toDate === 'function' ? item.updatedAt.toDate() : new Date(item.updatedAt);
            }

            return itemDate >= startDate && itemDate <= endDate;
        });

        displayUsageResults(filteredSpares);
    });
}

function displayUsageResults(spares) {
    if (!usageList || !usageResults) return;

    usageList.innerHTML = '';

    if (spares.length === 0) {
        usageList.innerHTML = '<li class="py-2 text-gray-500 text-center">No spares used in this timeframe.</li>';
    } else {
        spares.forEach(spare => {
            const li = document.createElement('li');
            li.className = "py-2 flex justify-between items-center";
            li.innerHTML = `
                <span class="font-medium text-gray-700">${escapeHtml(spare.name)}</span>
                <span class="text-orange-600 font-bold">-${spare.used} used</span>
            `;
            usageList.appendChild(li);
        });
    }

    usageResults.classList.remove('hidden');
}

// --- LIVE BARCODE GENERATOR PREVIEW ---
if (spareBarcodeInput) {
    spareBarcodeInput.addEventListener('input', (e) => {
        const value = e.target.value.trim();
        generateBarcodeSVG(value);
    });
}

function generateBarcodeSVG(text) {
    if (!barcodePreview) return;
    if (!text) {
        barcodePreview.innerHTML = "";
        return;
    }
    try {
        JsBarcode("#barcodePreview", text, {
            format: "CODE128",
            lineColor: "#1e293b",
            width: 1.5,
            height: 40,
            displayValue: true
        });
    } catch (e) {
        barcodePreview.innerHTML = "";
    }
}

// --- AUTO-GENERATE BARCODE LISTENER ---
if (generateBarcodeBtn) {
    generateBarcodeBtn.addEventListener('click', () => {
        const randomSku = 'SKU-' + Math.floor(10000000 + Math.random() * 90000000);
        if (spareBarcodeInput) {
            spareBarcodeInput.value = randomSku;
            spareBarcodeInput.dispatchEvent(new Event('input'));
        }
    });
}

if (printBarcodeBtn) {
    printBarcodeBtn.addEventListener('click', () => {
        window.print();
    });
}

// --- FORM SUBMIT (CREATE & UPDATE) ---
if (spareForm) {
    spareForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = editIdInput ? editIdInput.value : '';
        const name = spareNameInput ? spareNameInput.value.trim() : '';
        const quantity = spareQtyInput ? parseInt(spareQtyInput.value, 10) : 0;
        const used = spareUsedInput ? parseInt(spareUsedInput.value, 10) : 0;
        const barcode = spareBarcodeInput ? spareBarcodeInput.value.trim() : '';

        try {
            if (id) {
                await updateDoc(doc(db, "spare", id), {
                    name,
                    quantity,
                    used,
                    barcode,
                    updatedAt: new Date()
                });
                resetForm();
            } else {
                await addDoc(collection(db, "spare"), {
                    name,
                    quantity,
                    used,
                    barcode,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                spareForm.reset();
                if (barcodePreview) barcodePreview.innerHTML = "";
            }
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("Failed to save spare item.");
        }
    });
}

if (printDbBtn) {
    printDbBtn.addEventListener('click', () => {
        window.print();
    });
}

// --- GLOBAL ACTIONS ---
window.editSpare = function(id, name, quantity, barcode, used = 0) {
    if (editIdInput) editIdInput.value = id;
    if (spareNameInput) spareNameInput.value = name;
    if (spareQtyInput) spareQtyInput.value = quantity;
    if (spareUsedInput) spareUsedInput.value = used;
    if (spareBarcodeInput) spareBarcodeInput.value = barcode;
    generateBarcodeSVG(barcode);

    if (formTitle) formTitle.textContent = "Edit Spare";
    if (saveBtn) {
        saveBtn.textContent = "Update Spare";
        saveBtn.className = "w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium";
    }
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    if (spareNameInput) spareNameInput.focus();
};

window.deleteSpare = async function(id) {
    if (confirm("Are you sure you want to delete this spare item?")) {
        try {
            await deleteDoc(doc(db, "spare", id));
        } catch (error) {
            console.error("Error deleting document: ", error);
            alert("Failed to delete item.");
        }
    }
};

if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
        resetForm();
    });
}

function resetForm() {
    if (spareForm) spareForm.reset();
    if (editIdInput) editIdInput.value = "";
    if (barcodePreview) barcodePreview.innerHTML = "";
    if (spareUsedInput) spareUsedInput.value = "0";
    if (formTitle) formTitle.textContent = "Add New Spare";
    if (saveBtn) {
        saveBtn.textContent = "Save Spare";
        saveBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-medium";
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

function escapeHtml(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// --- BARCODE SCANNER LOGIC (HARDWARE SCANNER INTERCEPT) ---
let barcodeBuffer = "";
let barcodeTimer = null;

document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
    }

    if (e.key === "Enter") {
        if (barcodeBuffer.length > 3) {
            processScannedBarcode(barcodeBuffer);
        }
        barcodeBuffer = "";
        return;
    }

    if (e.key.length === 1) {
        barcodeBuffer += e.key;
        clearTimeout(barcodeTimer);
        barcodeTimer = setTimeout(() => {
            barcodeBuffer = "";
        }, 50);
    }
});

async function processScannedBarcode(scannedCode) {
    try {
        const q = query(collection(db, "spare"), where("barcode", "==", scannedCode));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const data = docSnap.data();

            let currentQty = Number(data.quantity) || 0;
            let currentUsed = (data.used !== undefined && data.used !== null) ? Number(data.used) : 0;

            let newQty = currentQty > 0 ? currentQty - 1 : 0;
            let newUsed = currentUsed + 1;

            await updateDoc(doc(db, "spare", docSnap.id), {
                quantity: newQty,
                used: newUsed,
                updatedAt: new Date()
            });

            console.log(`Scanned! ${data.name} updated. Qty: ${newQty}, Used: ${newUsed}`);
        } else {
            console.log("Barcode not found in database.");
        }
    } catch (error) {
        console.error("Error processing scan: ", error);
    }
}

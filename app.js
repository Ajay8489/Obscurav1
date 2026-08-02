import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
// Added query, where, and getDocs to handle the scanner database lookup
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- FIREBASE CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyDRZgMvYRjpuFlsTyoLTZK_mNuvA7jg4HE",
    authDomain: "obscura-9bb1a.firebaseapp.com",
    projectId: "obscura-9bb1a",
    storageBucket: "obscura-9bb1a.firebasestorage.app",
    messagingSenderId: "1081657320125",
    appId: "1:1081657320125:web:d97ca25751b1de71948dd4"
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
const spareUsedInput = document.getElementById('spareUsed'); // NEW: Added Used Input
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

        if (inventoryTableBody) {
            inventoryTableBody.innerHTML = "";
            if (totalUnique === 0) {
                // Changed colspan to 5 for the new column
                inventoryTableBody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400">No spares found in inventory.</td></tr>`;
            }
        }

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const id = docSnap.id;
            const rawName = data.name || "";
            const rawBarcode = data.barcode || "";
            const qty = Number(data.quantity) || 0;
            const used = Number(data.used) || 0; // NEW: Get used value from Firestore
            
            totalQty += qty;

            const row = document.createElement('tr');
            row.className = "hover:bg-gray-50 transition-colors";
            
            // NEW: Added the used column data
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
                    window.editSpare(id, rawName, qty, rawBarcode, used); // Passed used to edit function
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
            spareBarcodeInput.dispatchEvent(new Event('input')); // Triggers preview update
        }
    });
}

// --- PRINT SINGLE BARCODE LISTENER ---
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
        const used = spareUsedInput ? parseInt(spareUsedInput.value, 10) : 0; // NEW: Get used value
        const barcode = spareBarcodeInput ? spareBarcodeInput.value.trim() : '';

        try {
            if (id) {
                // Update existing record
                await updateDoc(doc(db, "spare", id), { name, quantity, used, barcode }); 
                resetForm();
            } else {
                // Create new record
                await addDoc(collection(db, "spare"), { name, quantity, used, barcode, createdAt: new Date() });
                spareForm.reset();
                if (barcodePreview) barcodePreview.innerHTML = "";
            }
        } catch (error) {
            console.error("Error saving document: ", error);
            alert("Failed to save spare item.");
        }
    });
}

// --- PRINT DATABASE BUTTON ---
if (printDbBtn) {
    printDbBtn.addEventListener('click', () => {
        window.print();
    });
}

// --- GLOBAL ACTIONS ---
window.editSpare = function(id, name, quantity, barcode, used = 0) { // NEW: added used param
    if (editIdInput) editIdInput.value = id;
    if (spareNameInput) spareNameInput.value = name;
    if (spareQtyInput) spareQtyInput.value = quantity;
    if (spareUsedInput) spareUsedInput.value = used; // Populate used field
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
    if (spareUsedInput) spareUsedInput.value = "0"; // Reset used field explicitly
    
    if (formTitle) formTitle.textContent = "Add New Spare";
    if (saveBtn) {
        saveBtn.textContent = "Save Spare";
        saveBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-medium";
    }
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

// --- HELPER FUNCTION ---
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
    // Ignore if typing inside the form fields
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
        // Query Firestore to find the item with this barcode
        const q = query(collection(db, "spare"), where("barcode", "==", scannedCode));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            // Document found, get the first match
            const docSnap = querySnapshot.docs[0];
            const data = docSnap.data();
            
            let currentQty = Number(data.quantity) || 0;
            let currentUsed = Number(data.used) || 0;

            // Decrease Qty by 1 (don't go below 0), Increase Used by 1
            let newQty = currentQty > 0 ? currentQty - 1 : 0;
            let newUsed = currentUsed + 1;

            // Update Firestore directly
            await updateDoc(doc(db, "spare", docSnap.id), {
                quantity: newQty,
                used: newUsed
            });
            
            console.log(`Scanned! ${data.name} updated. Qty: ${newQty}, Used: ${newUsed}`);
            // Optional: You can uncomment the line below to show an alert to the user
            // alert(`Scanned! ${data.name} marked as used.`);
        } else {
            console.log("Barcode not found in database.");
        }
    } catch (error) {
        console.error("Error processing scan: ", error);
    }
}

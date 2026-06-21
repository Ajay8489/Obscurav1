// Import Firebase SDK Modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ⚠️ PASTE YOUR CUSTOM FIREBASE CONFIG BLOCK HERE ⚠️
const firebaseConfig = {
    apiKey: "AIzaSyDRZgMvYRjpuFlsTyoLTZK_mNuvA7jg4HE",
    authDomain: "obscura-9bb1a.firebaseapp.com",
    projectId: "obscura-9bb1a",
    storageBucket: "obscura-9bb1a.firebasestorage.app",
    messagingSenderId: "1081657320125",
    appId: "1:1081657320125:web:d97ca25751b1de71948dd4"
};

// Initialize App and Firestore database references
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const inventoryCollection = collection(db, "spares");

// Route protection check
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'index.html';
}

document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('isLoggedIn');
    window.location.href = 'index.html';
});

// Cache dynamic references
let localInventoryCache = []; 

const formTitle = document.getElementById('formTitle');
const spareForm = document.getElementById('spareForm');
const editIdField = document.getElementById('editId');
const spareNameField = document.getElementById('spareName');
const spareQtyField = document.getElementById('spareQty');
const spareBarcodeField = document.getElementById('spareBarcode');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

// Stream data in real-time from Cloud Firestore
onSnapshot(inventoryCollection, (snapshot) => {
    const tbody = document.getElementById('inventoryTableBody');
    tbody.innerHTML = '';
    
    localInventoryCache = [];
    let totalQuantity = 0;

    if (snapshot.empty) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No spares found in database.</td></tr>`;
    }

    snapshot.forEach((documentSnapshot) => {
        const item = documentSnapshot.data();
        const id = documentSnapshot.id;
        
        // Push to local variable cache for scanner processing loops
        localInventoryCache.push({ id, ...item });
        totalQuantity += parseInt(item.qty);

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50";
        row.innerHTML = `
            <td class="p-4 font-medium text-gray-800">${item.name}</td>
            <td class="p-4 text-gray-500 font-mono text-xs"><span class="bg-gray-200 px-2 py-1 rounded">${item.barcode}</span></td>
            <td class="p-4 text-center font-bold ${item.qty <= 2 ? 'text-red-500' : 'text-gray-700'}">${item.qty}</td>
            <td class="p-4 text-right">
                <button data-id="${id}" class="edit-action text-blue-600 hover:text-blue-800 font-medium mr-3">Edit</button>
                <button data-id="${id}" class="delete-action text-red-600 hover:text-red-800 font-medium">Delete</button>
            </td>
        `;
        tbody.appendChild(row);
    });

    document.getElementById('totalUnique').innerText = snapshot.size;
    document.getElementById('totalQty').innerText = totalQuantity;
    attachTableEventListeners();
});

// Event attachments inside Module scope
function attachTableEventListeners() {
    document.querySelectorAll('.edit-action').forEach(btn => {
        btn.addEventListener('click', (e) => editItem(e.target.dataset.id));
    });
    document.querySelectorAll('.delete-action').forEach(btn => {
        btn.addEventListener('click', (e) => deleteItem(e.target.dataset.id));
    });
}

// Add or Update Entry
spareForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = spareNameField.value.trim();
    const qty = parseInt(spareQtyField.value);
    const barcode = spareBarcodeField.value.trim();
    const currentId = editIdField.value;

    if (!currentId) {
        // Double check uniqueness constraint across database barcodes
        const duplicateCheck = localInventoryCache.some(item => item.barcode === barcode);
        if (duplicateCheck) {
            alert("This barcode tracking number already exists inside system!");
            return;
        }
        await addDoc(inventoryCollection, { name, qty, barcode });
    } else {
        // Run specific Document target path merge update
        const docRef = doc(db, "spares", currentId);
        await updateDoc(docRef, { name, qty, barcode });
    }

    resetForm();
});

function editItem(id) {
    const target = localInventoryCache.find(item => item.id === id);
    if (!target) return;

    formTitle.innerText = "Edit Spare Part";
    editIdField.value = id;
    spareNameField.value = target.name;
    spareQtyField.value = target.qty;
    spareBarcodeField.value = target.barcode;
    
    saveBtn.innerText = "Update Spare";
    cancelBtn.classList.remove('hidden');
}

async function deleteItem(id) {
    if (confirm("Are you sure you want to permanently delete this camera spare?")) {
        await deleteDoc(doc(db, "spares", id));
    }
}

cancelBtn.addEventListener('click', resetForm);

function resetForm() {
    formTitle.innerText = "Add New Spare";
    editIdField.value = "";
    spareForm.reset();
    saveBtn.innerText = "Save Spare";
    cancelBtn.classList.add('hidden');
}

// Barcode Scanning Deduct logic connected directly to Cloud Firestore
async function processScannedBarcode(decodedText) {
    const feedback = document.getElementById('scanFeedback');
    const matchedItem = localInventoryCache.find(item => item.barcode === decodedText);

    if (matchedItem) {
        if (matchedItem.qty > 0) {
            const docRef = doc(db, "spares", matchedItem.id);
            await updateDoc(docRef, {
                qty: matchedItem.qty - 1
            });
            feedback.innerText = `✅ Found: ${matchedItem.name} (-1)`;
            feedback.className = "text-center text-sm font-semibold mt-2 text-green-600";
        } else {
            feedback.innerText = `⚠️ ${matchedItem.name} is completely out of stock!`;
            feedback.className = "text-center text-sm font-semibold mt-2 text-orange-500";
        }
    } else {
        feedback.innerText = `❌ Unknown Barcode: "${decodedText}"`;
        feedback.className = "text-center text-sm font-semibold mt-2 text-red-500";
    }

    setTimeout(() => {
        feedback.innerText = "Scanning for next item...";
        feedback.className = "text-center text-sm font-semibold mt-2 text-gray-500";
    }, 3000);
}

// Mount HTML5 QR Engine Scanner
const html5QrcodeScanner = new Html5QrcodeScanner(
    "reader", { fps: 10, qrbox: { width: 250, height: 120 } }, false
);
html5QrcodeScanner.render((text) => processScannedBarcode(text), (err) => {});

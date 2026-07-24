import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js"; 
import { getAuth, signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js"; 
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js"; 

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
const scanFeedback = document.getElementById('scanFeedback'); 

// New Action Triggers 
const generateBarcodeBtn = document.getElementById('generateBarcodeBtn'); 
const printBarcodeBtn = document.getElementById('printBarcodeBtn'); 

// --- AUTHENTICATION --- 
onAuthStateChanged(auth, (user) => {
  if (user) {
    initInventoryListener(); 
  } else {
    signInAnonymously(auth).catch((error) => {
      console.error("Authentication error:", error); 
    }); 
  } 
}); 

logoutBtn.addEventListener('click', () => {
  signOut(auth).then(() => {
    location.reload(); 
  }).catch((error) => {
    console.error("Logout error:", error); 
  }); 
}); 

// --- REAL-TIME FIRESTORE LISTENER --- 
function initInventoryListener() {
  const q = collection(db, "spare");
  onSnapshot(q, (snapshot) => {
    let totalUnique = snapshot.size; 
    let totalQty = 0; 
    inventoryTableBody.innerHTML = ""; 

    if (totalUnique === 0) {
      inventoryTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400">No spares found in inventory.</td></tr>`; 
    } 

    snapshot.forEach((docSnap) => {
      const data = docSnap.data(); 
      const id = docSnap.id; 
      const rawName = data.name || "";
      const rawBarcode = data.barcode || "";
      const qty = Number(data.quantity) || 0; 
      totalQty += qty; 

      const row = document.createElement('tr'); 
      row.className = "hover:bg-gray-50 transition-colors"; 

      // Safe row template without broken string attributes
      row.innerHTML = ` 
        <td class="p-4 font-medium text-gray-800">${escapeHtml(rawName)}</td> 
        <td class="p-4 font-mono text-gray-600">${escapeHtml(rawBarcode)}</td> 
        <td class="p-4 text-center font-semibold text-gray-700">${qty}</td> 
        <td class="p-4 text-right space-x-2"> 
          <button type="button" class="edit-btn text-blue-600 hover:text-blue-800 font-medium text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded">Edit</button> 
          <button type="button" class="delete-btn text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded">Delete</button> 
        </td> 
      `; 

      // Safely attach event listeners using native DOM targeting
      row.querySelector('.edit-btn').addEventListener('click', () => {
        window.editSpare(id, rawName, qty, rawBarcode);
      });

      row.querySelector('.delete-btn').addEventListener('click', () => {
        window.deleteSpare(id);
      });

      inventoryTableBody.appendChild(row); 
    }); 

    totalUniqueEl.textContent = totalUnique; 
    totalQtyEl.textContent = totalQty; 
  }, (error) => {
    console.error("Error fetching inventory: ", error); 
    inventoryTableBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-500">Error loading inventory data.</td></tr>`; 
  }); 
} 

// --- LIVE BARCODE GENERATOR PREVIEW --- 
spareBarcodeInput.addEventListener('input', (e) => {
  const value = e.target.value.trim(); 
  generateBarcodeSVG(value); 
}); 

function generateBarcodeSVG(text) {
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

// --- NEW: AUTO-GENERATE BARCODE LISTENER --- 
generateBarcodeBtn.addEventListener('click', () => {
  const randomSku = 'SKU-' + Math.floor(10000000 + Math.random() * 90000000); 
  spareBarcodeInput.value = randomSku; 
  generateBarcodeSVG(randomSku); 
}); 

// --- NEW: PRINT SINGLE BARCODE LISTENER --- 
printBarcodeBtn.addEventListener('click', () => {
  window.print(); 
}); 

// --- FORM SUBMIT (CREATE & UPDATE) --- 
spareForm.addEventListener('submit', async (e) => {
  e.preventDefault(); 
  const id = editIdInput.value; 
  const name = spareNameInput.value.trim(); 
  const quantity = parseInt(spareQtyInput.value, 10); 
  const barcode = spareBarcodeInput.value.trim(); 

  try {
    if (id) {
      await updateDoc(doc(db, "spare", id), { name, quantity, barcode }); 
      resetForm(); 
    } else {
      await addDoc(collection(db, "spare"), { name, quantity, barcode, createdAt: new Date() }); 
      spareForm.reset(); 
      barcodePreview.innerHTML = ""; 
    } 
  } catch (error) {
    console.error("Error saving document: ", error); 
    alert("Failed to save spare item."); 
  } 
}); 

// --- PRINT DATABASE BUTTON --- 
printDbBtn.addEventListener('click', () => {
  window.print(); 
}); 

// --- GLOBAL ACTIONS --- 
window.editSpare = function(id, name, quantity, barcode) {
  editIdInput.value = id; 
  spareNameInput.value = name; 
  spareQtyInput.value = quantity; 
  spareBarcodeInput.value = barcode; 
  generateBarcodeSVG(barcode); 
  formTitle.textContent = "Edit Spare"; 
  saveBtn.textContent = "Update Spare"; 
  saveBtn.className = "w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-medium"; 
  cancelBtn.classList.remove('hidden'); 
  spareNameInput.focus(); 
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

cancelBtn.addEventListener('click', () => {
  resetForm(); 
}); 

function resetForm() {
  spareForm.reset(); 
  editIdInput.value = ""; 
  barcodePreview.innerHTML = ""; 
  formTitle.textContent = "Add New Spare"; 
  saveBtn.textContent = "Save Spare"; 
  saveBtn.className = "w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded font-medium"; 
  cancelBtn.classList.add('hidden'); 
} 

// --- BARCODE SCANNER INTEGRATION --- 
function onScanSuccess(decodedText) {
  spareBarcodeInput.value = decodedText; 
  generateBarcodeSVG(decodedText); 
  scanFeedback.textContent = `Scanned successfully: ${decodedText}`; 
  scanFeedback.className = "text-center text-sm font-semibold mt-2 text-emerald-600"; 
  spareQtyInput.focus(); 
} 

function onScanFailure() {} 

try {
  const html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 150 } }, false); 
  html5QrcodeScanner.render(onScanSuccess, onScanFailure); 
} catch (e) {
  console.warn("QR/Barcode Scanner failed to initialize:", e); 
  scanFeedback.textContent = "Camera initialization failed."; 
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

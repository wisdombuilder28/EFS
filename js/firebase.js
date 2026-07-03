import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  updateDoc, deleteDoc, doc, orderBy, query,
  onSnapshot, increment, arrayUnion
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyDIsy4Hkqip2v3LraBk6CqH_TWONdjiwsc",
  authDomain:        "emeakaroha-school-news.firebaseapp.com",
  projectId:         "emeakaroha-school-news",
  storageBucket:     "emeakaroha-school-news.firebasestorage.app",
  messagingSenderId: "646820380800",
  appId:             "1:646820380800:web:ce62537a23c3eb37b02665",
  measurementId:     "G-LTB9YSH7GE"
};

const app             = initializeApp(firebaseConfig);
const db              = getFirestore(app);
const postsCollection = collection(db, "announcements");

// arrayUnion: adds a comment object into the post's comments array
// without overwriting existing comments. No subcollection needed —
// comments live inside the post document, so existing rules cover them.
export {
  db, postsCollection, collection,
  addDoc, getDocs, updateDoc, deleteDoc, doc,
  query, orderBy, onSnapshot, increment, arrayUnion
};
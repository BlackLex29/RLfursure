import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";




   const firebaseConfig = {
     apiKey: " AIzaSyBIFU50U-IJ_v9PaN3u1oii5PxQ3p9JBAg",
     authDomain: "fursure-9e796.firebaseapp.com",
     projectId: "fursure-9e796",
     storageBucket: "fursure-9e796.appspot.com",
     messagingSenderId: "8114966521",
     appId: "1:8114966521:web:058af6fdd6111c8c776c68",
     measurementId: "G-YQKHQ90SGL"
   };
   

 const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
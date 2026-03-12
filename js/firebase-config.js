// Configuração do Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCXPbfBbjJ8nQAzGBCAm3eFSQzb10cPy9w",
    authDomain: "cha-de-panela-emily.firebaseapp.com",
    projectId: "cha-de-panela-emily",
    storageBucket: "cha-de-panela-emily.firebasestorage.app",
    messagingSenderId: "713690355776",
    appId: "1:713690355776:web:b8d03577149caa23fb27a5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

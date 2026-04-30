// Firebase Configuration
// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();

/**
 * Global Discovery & Chat API
 */
const FirebaseManager = {
    // --- Global Chat ---
    syncChat(onNewMessage) {
        db.ref('chat').limitToLast(20).on('child_added', (snapshot) => {
            onNewMessage(snapshot.val());
        });
    },

    postChat(msg) {
        db.ref('chat').push(msg);
    },

    // --- Table Discovery ---
    registerTable(pin, gameName, hostName) {
        const tableRef = db.ref(`active_tables/${pin}`);
        tableRef.set({
            pin,
            gameName,
            hostName,
            createdAt: firebase.database.ServerValue.TIMESTAMP
        });
        
        // Remove table when host disconnects
        tableRef.onDisconnect().remove();
    },

    watchTables(onTablesUpdate) {
        db.ref('active_tables').on('value', (snapshot) => {
            const tables = snapshot.val() || {};
            onTablesUpdate(Object.values(tables));
        });
    }
};

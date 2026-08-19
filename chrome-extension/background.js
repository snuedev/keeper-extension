const firebaseConfig = {
  apiKey: "AIzaSyCEIGUChToGQwsiQ00FuA8oHeXNiryayyY",
  authDomain: "keeperext.firebaseapp.com",
  projectId: "keeperext",
  storageBucket: "keeperext.firebasestorage.app",
  messagingSenderId: "222138233823",
  appId: "1:222138233823:web:27f1e6c19fa7c5c3120a6a"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();
db.ref("users/test").set({
  name: "John Doe",
  age: 30
});

const db = firebase.firestore();
db.collection("users").get()
  .then(querySnapshot => {
    querySnapshot.forEach(doc => {
      console.log(doc.id, " => ", doc.data());
    });
  });


<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js"></script>
<script src="https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js"></script>

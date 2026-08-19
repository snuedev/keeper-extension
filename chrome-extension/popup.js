document.getElementById("writeData").addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "writeToFirebase" });
});

// Example: Sign in with email/password
firebase.auth().signInWithEmailAndPassword(email, password)
  .catch(error => {
    console.error("Authentication error:", error);
  });

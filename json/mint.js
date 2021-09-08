let number = "4";

setTimeout(() => {
  document.getElementById("mintInput").value = number;
  document.getElementById("mint").click();
}, 1000 /* Milliseconds to wait before looping again */);

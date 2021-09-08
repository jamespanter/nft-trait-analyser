let nMint = 4;
let delay = 200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

alertify.set("notifier", "position", "top-left");

window.onload = async function () {
  console.log("ready");
  try {
    alertify.notify("Ready...");
    alertify.message("Monitoring...", 0);
    var monitor1 = setInterval(() => {
      var timer = document.querySelector('h2[id="sale"]').innerText;
      console.log(timer);
      if (timer == "Mint phase begins in 00 : 00 : 00 : 00") {
        clearInterval(monitor1);
        await sleep(500);
        alertify.notify("Live!");
        alertify.notify("Trying mint...");
        document.querySelector('input[id="mintInput"]').value = nMint;
        sleep(100);
        document.querySelector("#mint").click();
      }
    }, delay);
  } catch (e) {
    alertify.error("Error: " + e);
  }
};

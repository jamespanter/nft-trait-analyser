// Search HTML
const infoPanelContainer = document.getElementById("info-panel-container");
const searchContainer = document.getElementById("search-container");
const searchIndexWordContainer = document.getElementById(
  "search-index-word-container"
);
const maxIndexContainer = document.getElementById("max-index");

// NFT HTML
const nameContainer = document.getElementById("name");
const attributesContainer = document.getElementById("attributes");
const image = document.getElementById("image");

// Traits HTML
const traitContainer = document.getElementById("traits-container");
const traitCategoryContainer = document.getElementById("trait-categories");

// Data variables
let currentIndex = 0;
let maxIndex;
let traitsArray = [];
let url;

const didClickGo = () => {
  maxIndex = maxIndexContainer.value;
  url = searchContainer.value;

  fetchAll();
};

const fetchAll = () => {
  // Check if finished
  if (currentIndex >= maxIndex) {
    return;
  }

  let valueToReplace = searchIndexWordContainer.value;
  let urlReplacingPlaceholder = url.replace(valueToReplace, currentIndex);

  console.log(`Fetching ${currentIndex}...`);
  fetch(urlReplacingPlaceholder)
    .then((response) => response.json())
    .then((result) => {
      updateTraits(result.attributes);
      currentIndex++;
      fetchAll();
    })
    .catch((error) => console.log(error));
};

const updateTraits = (traits) => {
  traits.forEach((trait) => {
    let newTraitCategory = trait["trait_type"];
    let newTraitValue = trait["value"];

    let indexOfCategory = traitsArray.findIndex(
      (index) => index.traitCategory === newTraitCategory
    );

    // Check if category already exists
    if (indexOfCategory != -1) {
      // Check if value already exists

      let indexOfValue = traitsArray[indexOfCategory].traitValues.findIndex(
        (index) => index.traitValue === newTraitValue
      );

      let currentTraitValues = traitsArray[indexOfCategory].traitValues;

      if (indexOfValue != -1) {
        // Increment value by 1
        currentTraitValues[indexOfValue].traitCount += 1;
        traitsArray[indexOfCategory].traitValues = currentTraitValues;
      } else {
        // Add new value
        currentTraitValues.push({ traitValue: newTraitValue, traitCount: 1 });
        traitsArray[indexOfCategory].traitValues = currentTraitValues;
      }
    } else {
      // Add new trait category & trait value
      traitsArray.push({
        traitCategory: newTraitCategory,
        traitValues: [{ traitValue: newTraitValue, traitCount: 1 }],
      });
    }
  });

  updateHTML();
};

const updateHTML = () => {
  traitCategoryContainer.innerHTML = traitsArray
    .map((index) => {
      return `<div id="trait-category-container">
      <div id="trait-category-name">${index.traitCategory}</div>
      ${index.traitValues
        .map((value) => {
          return `<div id="trait-value">${value.traitValue}: ${value.traitCount}</div>`;
        })
        .join("")}</div>`;
    })
    .join("");

  console.log(traitsArray);
};

const orderByRarity = () => {
  traitsArray.forEach((category) => {});
};

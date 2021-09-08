const searchPresetsContainer = document.getElementById(
  "search-preset-container"
);
const searchContainer = document.getElementById("search-container");
const searchReplaceIndexContainer = document.getElementById(
  "search-replace-index-container"
);
const minTokenContainer = document.getElementById("min-index");
const maxTokenContainer = document.getElementById("max-index");
const apiDelayContainer = document.getElementById("api-delay");
const revealDateContainer = document.getElementById("reveal-date");
const contractAddressContainer = document.getElementById("contract-address");
const progressContainer = document.getElementById("progress");
const traitNormalisationCheckbox = document.getElementById(
  "trait-normalisation"
);
const searchCollapsableContainer = document.getElementById(
  "search-collapsable-container"
);
let avgResponseTimeContainer = document.getElementById("average-response-time");
const infoPanelContainer = document.getElementById("info-panel-container");
const removeDuplicateTraitCategoriesCheckbox = document.getElementById(
  "duplicate-trait-categories"
);
const callAsyncCheckbox = document.getElementById("call-async");
const offsetTokenContainer = document.getElementById("token-offset");
const fetchTraitsButton = document.getElementById("fetch-traits-button");
const calculateTraitsButton = document.getElementById(
  "calculate-trait-score-button"
);
const traitContainer = document.getElementById("traits-container");
const categoryContainer = document.getElementById("trait-categories");
const tokenScoresContainer = document.getElementById("token-scores");
const openseaResultCountContainer = document.getElementById(
  "opensea-result-count"
);
const searchResultsContainer = document.getElementById("search-results");
const openseaFindResultsId = document.getElementById("opensea-find-result-id");
const openseaOnlyCheckbox = document.getElementById("opensea-only");
const buyItNowOnlyCheckbox = document.getElementById("buy-it-now-only");
const readySound = new Audio("./assets/ding.wav");

let callAsync = true;
let traitNormalisation = true;
let removeDuplicateTraitCategories = true;
let fetchesCompleted = 0;
let fetchesFailed = 0;
let minTokenValue;
let maxTokenValue;
let totalSupply;
let apiDelay;
let stringForTraitType = "trait_type";
let stringForTraitValue = "value";
let fetchFinished = false;
let tokenOffset = 0;
let firstResponseSuccessful = false;
let maxOutstandingFetchThreshold = 500;

let urls = [];
let traitsModelArray = [];
let tokensArray = [];
let scoredTokensArray = [];
let openseaDataArray = [];
let responseTimes = [];
let outstandingFetches = 0;
let allowedToFetch = true;

const reload = () => {
  location.reload();
};

const handleCollapseTraitModel = (element) => {
  let positionInfo = element.getBoundingClientRect();
  let currentHeight = positionInfo.height;

  element.style.height = currentHeight == 35 ? "auto" : "35px";
};

const handleCollapseOpenseaToken = (element) => {
  element.childNodes[3].style.visibility =
    element.offsetWidth == 180 ? "visible" : "hidden";
  element.style.minWidth = element.offsetWidth == 180 ? "350px" : "180px";
};

const initFetch = () => {
  searchPresetsContainer.disabled = true;
  contractAddressContainer.disabled = true;
  searchContainer.disabled = true;
  searchReplaceIndexContainer.disabled = true;
  minTokenContainer.disabled = true;
  maxTokenContainer.disabled = true;
  apiDelayContainer.disabled = true;
  revealDateContainer.disabled = true;
  offsetTokenContainer.disabled = true;
  removeDuplicateTraitCategoriesCheckbox.disabled = true;
  callAsyncCheckbox.disabled = true;
  fetchTraitsButton.disabled = true;
  infoPanelContainer.style.display = "none";
  calculateTraitsButton.disabled = false;

  tokenOffset = offsetTokenContainer.value;
  fetchesCompleted = 0;
  fetchesFailed = 0;
  minTokenValue = parseInt(minTokenContainer.value);
  maxTokenValue = parseInt(maxTokenContainer.value);
  totalSupply = maxTokenValue - minTokenValue + 1;
  apiDelay = apiDelayContainer.value;

  urls = [];
  traitsModelArray = [];
  tokensArray = [];
  scoredTokensArray = [];
  openseaDataArray = [];

  generateURLS();

  if (callAsync) {
    fetchAllAsync();
  } else {
    fetchAllSync(0);
  }
};

const generateURLS = () => {
  let templateURL = searchContainer.value;
  let valueToReplace = searchReplaceIndexContainer.value;

  for (let i = minTokenValue; i < maxTokenValue + 1; i++) {
    urls.push(templateURL.replace(valueToReplace, i + parseInt(tokenOffset)));
  }
};

const fetchAllSync = (urlAtIndex) => {
  let startTime = performance.now();
  outstandingFetches += 1;
  fetch(urls[urlAtIndex])
    .then((response) => response.json())
    .then((data) => {
      outstandingFetches -= 1;
      let finishTime = performance.now();
      let responseTime = finishTime - startTime;
      responseTimes.push(responseTime);
      updateAverageResponseTimeHTML();

      // Sound to notify
      if (data.attributes.length != 0 && firstResponseSuccessful == false) {
        firstResponseSuccessful = true;
        // console.log(data.attributes);
        readySound.play();
      }

      // Attempt to fail safely if attributes not present before reveal
      // By adding in an empty attributes field.
      if (!data.hasOwnProperty("attributes")) {
        data.attributes = [];
      }

      // Remove any duplicate trait that also has duplicate value
      // We consider this a bug in the API from the devs
      data.attributes = data.attributes.filter(
        (attribute, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              t.trait_type === attribute.trait_type &&
              t.value === attribute.value
          )
      );

      let traitCount = data.attributes.length;
      // If configured true, we won't count a duplicate trait category,
      // with a unique value, in our trait count
      if (removeDuplicateTraitCategories) {
        let traitCategories = data.attributes.map((trait) => trait.trait_type);
        traitCount = countUnique(traitCategories);
      }

      // If an NFT has a trait with value "none", we will
      // consider it not a trait
      data.attributes.forEach((trait) => {
        // Remove this block to NOT merge "" with "none"
        // if (trait[stringForTraitValue] == "") {
        //   trait[stringForTraitValue] = "none";
        // }
        if (
          trait[stringForTraitValue] == "None" ||
          trait[stringForTraitValue] == "none"
        ) {
          traitCount--;
        }
      });

      // Add meta 'trait' - Trait Count
      data.attributes.unshift({
        trait_type: "trait Count",
        value: traitCount,
      });

      // Store the ID of the NFT
      data.id = urlAtIndex + minTokenValue;
      // Store response data after applying tweaks
      // We need this later to rescan the tokens against
      // the score model
      tokensArray.push(data);

      fetchesCompleted++;
      updateTraitData(data.attributes);
      updateProgressHTML();

      // Fetch next if possible
      let nextURLIndex = urlAtIndex + 1;
      if (nextURLIndex < urls.length - 1) {
        fetchAllSync(nextURLIndex);
      }
    })
    .catch((error) => {
      fetchesFailed++;
      updateProgressHTML();
      console.log(error);
      // Fetch next if possible
      let nextURLIndex = urlAtIndex + 1;
      if (nextURLIndex < urls.length - 1) {
        fetchAllSync(nextURLIndex);
      }
    });
};

const fetchAllAsync = () => {
  urls.forEach((url, i) => {
    (function fetchWhenAllowed(isRetry = false, retryAttempts = 0) {
      if (allowedToFetch) {
        // console.log(`index: ${i}, allowedToFetch: ${allowedToFetch}`);
        let startTime = performance.now();

        outstandingFetches += 1;
        updateAllowedToFetchStatus();
        updateProgressHTML();

        setTimeout(() => {
          fetch(url)
            .then((response) => response.json())
            .then((data) => {
              if (isRetry) {
                console.log(`${i} retry success`);
              }

              outstandingFetches -= 1;
              updateAllowedToFetchStatus();
              updateProgressHTML();

              let finishTime = performance.now();
              let responseTime = finishTime - startTime;
              responseTimes.push(responseTime);
              updateAverageResponseTimeHTML();

              // Sound to notify
              if (
                data.attributes != null &&
                data.attributes.length != 0 &&
                firstResponseSuccessful == false
              ) {
                firstResponseSuccessful = true;
                readySound.play();
              }

              // Attempt to fail safely if attributes not present before reveal
              // By adding in an empty attributes field.
              if (!data.hasOwnProperty("attributes")) {
                data.attributes = [];
              }

              // Remove any duplicate trait that also has duplicate value
              // We consider this a bug in the API from the devs
              data.attributes = data.attributes.filter(
                (attribute, index, self) =>
                  index ===
                  self.findIndex(
                    (t) =>
                      t.trait_type === attribute.trait_type &&
                      t.value === attribute.value
                  )
              );

              let traitCount = data.attributes.length;
              // If configured true, we won't count a duplicate trait category,
              // with a unique value, in our trait count
              if (removeDuplicateTraitCategories) {
                let traitCategories = data.attributes.map(
                  (trait) => trait.trait_type
                );
                traitCount = countUnique(traitCategories);
              }

              // If an NFT has a trait with value "none", we will
              // consider it not a trait
              data.attributes.forEach((trait) => {
                // Remove this block to NOT merge "" with "none"
                // if (trait[stringForTraitValue] == "") {
                //   trait[stringForTraitValue] = "none";
                // }
                if (
                  trait[stringForTraitValue] == "None" ||
                  trait[stringForTraitValue] == "none"
                ) {
                  traitCount--;
                }
              });

              // Add meta 'trait' - Trait Count
              data.attributes.unshift({
                trait_type: "trait Count",
                value: traitCount,
              });

              // Store the ID of the NFT
              data.id = i + minTokenValue;
              // Store response data after applying tweaks
              // We need this later to rescan the tokens against
              // the score model
              tokensArray.push(data);

              fetchesCompleted++;
              updateTraitData(data.attributes);
              updateProgressHTML();
            })
            .catch((error) => {
              outstandingFetches -= 1;
              updateAllowedToFetchStatus();

              fetchesFailed++;
              updateProgressHTML();

              if (isRetry) {
                console.log(
                  `${i + minTokenValue} retry failed x ${retryAttempts}`
                );
              } else {
                console.log(`${i + minTokenValue} failed`);
              }
              setTimeout(function () {
                fetchWhenAllowed(true, retryAttempts + 1);
              }, 3000);
            });
        }, apiDelay);
      } else {
        setTimeout(function () {
          fetchWhenAllowed(false);
        }, 300);
      }
    })();
  });
};

const updateAllowedToFetchStatus = () => {
  if (outstandingFetches > maxOutstandingFetchThreshold) {
    allowedToFetch = false;
  } else {
    allowedToFetch = true;
  }
};

const countUnique = (iterable) => {
  return new Set(iterable).size;
};

const updateTraitData = (newTraitsData) => {
  // Add in any missing trait categories that have
  // already been discovered to simplify later logic.
  let categoriesDiscoveredSoFar = traitsModelArray.map(
    (trait) => trait.category
  );

  categoriesDiscoveredSoFar.forEach((category) => {
    let indexOfLookupCategory = newTraitsData.findIndex(
      (trait) => trait[stringForTraitType] == category
    );

    if (indexOfLookupCategory == -1) {
      newTraitsData.push({
        trait_type: category,
        value: "none",
      });
    }
  });

  newTraitsData.forEach((trait) => {
    let newTraitCategory = trait[stringForTraitType];
    let newTraitValue = trait[stringForTraitValue];

    let indexOfCategory = traitsModelArray.findIndex(
      (trait) => trait.category == newTraitCategory
    );

    // Check if category already exists
    if (indexOfCategory != -1) {
      // Category already exists, so check if value already exists
      let indexOfValue = traitsModelArray[indexOfCategory].values.findIndex(
        (value) => value.name == newTraitValue
      );
      let currentTraitValues = traitsModelArray[indexOfCategory].values;
      if (indexOfValue != -1) {
        // Value already exists, so increment count by 1
        currentTraitValues[indexOfValue].count += 1;

        let percentage = getPercentageOfTraitValue(
          currentTraitValues[indexOfValue].count
        );
        currentTraitValues[indexOfValue].percentage = percentage;
      } else {
        // Value does not already exists, so add new value
        let percentage = getPercentageOfTraitValue(1);
        currentTraitValues.push({
          name: newTraitValue,
          count: 1,
          percentage: percentage,
          score: 0,
        });
        traitsModelArray[indexOfCategory].values = currentTraitValues;
      }
    } else {
      // Category does not exist, so add new category & value
      // along with a "none" template
      let percentage = getPercentageOfTraitValue(1);
      traitsModelArray.push({
        category: newTraitCategory,
        values: [
          {
            name: "none",
            count: 0,
            percentage: 0,
            score: 0,
          },
          {
            name: newTraitValue,
            count: 1,
            percentage: percentage,
            score: 0,
          },
        ],
      });
    }
  });
  // We can update the traits here but it's very taxing
  // updateTraitHTML();
};

const updateTraitHTML = () => {
  orderTraitValues();

  categoryContainer.innerHTML = traitsModelArray
    .map((trait) => {
      let isMetaData = trait.category == "trait Count";
      return `<div class="trait-category-container${
        isMetaData ? ` meta" style="height: auto;"` : ""
      }">
      <div class="trait-category-name" onclick="handleCollapseTraitModel(this.parentElement)">${
        isMetaData ? "Meta data - " : ""
      }${trait.category} (${trait.values.length})</div>
      <div class="trait-value-container">
      <div class="trait-value"></div>
      <div class="trait-value-count"><b>Count</b></div>
      <div class="trait-value-percentage"><b>%</b></div>
      <div class="trait-value-score"><b>Score</b></div>
      </div>
      ${trait.values
        .map((value) => {
          return `<div class="trait-value-container">
          <div class="trait-value">${value.name}</div>
          <div class="trait-value-count">${value.count}</div>
          <div class="trait-value-percentage">${
            Math.round(value.percentage * 100 * 100) / 100
          }%</div>
          <div class="trait-value-score">${
            Math.round(value.score * 100) / 100
          }</div>
          </div>`;
        })
        .join("")}</div>`;
    })
    .join("");
};

const updateProgressHTML = () => {
  progressContainer.innerHTML = `<span>SUCCESS: <span class="fetch-success">${fetchesCompleted}</span>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; RETRIES: <span class="fetch-failure">${fetchesFailed}</span> &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;OF ${totalSupply}</span>`;

  if (fetchesCompleted + fetchesFailed == totalSupply) {
    fetchFinished = true;
  }
};

const updateAverageResponseTimeHTML = () => {
  let avgResponseTime = Math.round(average(responseTimes));
  avgResponseTimeContainer.innerHTML = `Outstanding fetches: <b>${outstandingFetches}</b>`;
};

const average = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

const updateTraitNormalisation = (element) => {
  let isChecked = element.checked == true;
  traitNormalisation = isChecked ? true : false;

  calcTraitScores();
};

const updateCallAsync = (element) => {
  let isChecked = element.checked == true;
  callAsync = isChecked ? true : false;
  apiDelayContainer.disabled = !isChecked;
};

const updateDuplicateTraitCategories = (element) => {
  let isChecked = element.checked == true;
  removeDuplicateTraitCategories = isChecked ? true : false;
};

const getPercentageOfTraitValue = (count) => {
  return count / totalSupply;
};

const calculateScoreForValue = (
  countOfASpecificTraitValue,
  quantityOfValuesInCategory
) => {
  if (countOfASpecificTraitValue == 0) {
    return 0;
  }

  if (traitNormalisation) {
    let totalTraits = traitsModelArray.length;
    let n = 1 / countOfASpecificTraitValue;

    return (1e6 * n) / (totalTraits * quantityOfValuesInCategory);
  } else {
    return 1 / (countOfASpecificTraitValue / totalSupply);
  }
};

const calcTraitScores = () => {
  calculateTraitsButton.disabled = true;
  if (fetchFinished) {
    // Remove "none" that have count 0
    traitsModelArray.forEach((trait) => {
      let indexOfNoneCountZero = trait.values.findIndex((value) => {
        return (
          (value.name == "None" || value.name == "none") && value.count == 0
        );
      });

      if (indexOfNoneCountZero != -1) {
        trait.values.splice(indexOfNoneCountZero, 1);
      }
    });
  }

  traitsModelArray.forEach((trait) => {
    trait.values.forEach((value) => {
      value.score = calculateScoreForValue(value.count, trait.values.length);
    });
  });

  calcTokensScore();
  updateTraitHTML();
  fetchOpenSea();
};

const calcTokensScore = () => {
  scoredTokensArray = [];

  tokensArray.forEach((token) => {
    let totalScore = 0;
    token.attributes.forEach((trait) => {
      let categoryToLookup = trait["trait_type"];
      let nameToLookup = trait["value"];

      let indexOfTraitCategory = traitsModelArray.findIndex(
        (trait) => trait.category === categoryToLookup
      );

      if (indexOfTraitCategory != -1) {
        let indexOfTraitValue = traitsModelArray[
          indexOfTraitCategory
        ].values.findIndex((value) => value.name === nameToLookup);

        let score =
          traitsModelArray[indexOfTraitCategory].values[indexOfTraitValue]
            .score;
        trait.score = score;
        totalScore += score;
      }
    });

    const templateURL = searchContainer.value;
    const valueToReplace = searchReplaceIndexContainer.value;
    const tokenURL = templateURL.replace(valueToReplace, token.id);

    scoredTokensArray.push({
      tokenId: token.id,
      tokenScore: totalScore,
      tokenTraits: token.attributes,
      tokenURL: tokenURL,
      tokenAPIImage: token.image,
    });
  });

  orderScoredTokensArray();

  scoredTokensArray.forEach((token, index) => {
    token.rank = index + 1;
  });
};

const orderScoredTokensArray = () => {
  scoredTokensArray.sort((a, b) => (a.tokenScore > b.tokenScore ? -1 : 1));
};

const orderTraitValues = () => {
  traitsModelArray.forEach((category) => {
    category.values.sort((a, b) => a.count - b.count);
  });
};

const displayLoadingHTML = () => {
  tokenScoresContainer.innerHTML = `<div style="width: 100%">Loading...<div>`;
};

const fetchOpenSea = () => {
  displayLoadingHTML();
  console.log("Scored Tokens Array:");
  console.log(scoredTokensArray);

  openseaDataArray = [];
  let searchRequestInput = searchResultsContainer.value;
  const requestQuantity =
    searchRequestInput > totalSupply ? totalSupply : searchRequestInput;
  const maxTokensPerAPICall = 30;
  const requiredFetches = Math.ceil(
    (requestQuantity > totalSupply ? totalSupply : requestQuantity) /
      maxTokensPerAPICall
  );

  let fetchResponses = 0;
  for (let i = 0; i < requiredFetches; i++) {
    const quantityInEachFetch =
      i == requiredFetches - 1
        ? 30 - Math.abs(requestQuantity - requiredFetches * maxTokensPerAPICall)
        : maxTokensPerAPICall;

    let fetchAddress = `https://api.opensea.io/api/v1/assets?asset_contract_address=${contractAddressContainer.value}&limit=${quantityInEachFetch}&include_orders=true`;

    scoredTokensArray.forEach((token, index) => {
      let lowerLimitIndex = maxTokensPerAPICall * i;
      let higherLimitIndex =
        maxTokensPerAPICall * (i + 1) -
        (maxTokensPerAPICall - quantityInEachFetch);

      if (index >= lowerLimitIndex && index < higherLimitIndex) {
        fetchAddress = fetchAddress.concat(`&token_ids=${token.tokenId}`);
      }
    });

    const options = { method: "GET" };
    fetch(fetchAddress, options)
      .then((response) => response.json())
      .then((response) => {
        fetchResponses += 1;
        response.assets.forEach((token) => {
          let matchingToken = scoredTokensArray.find((nft) => {
            return nft.tokenId == token.token_id;
          });

          let currentPrice =
            token.sell_orders != null ? token.sell_orders[0].current_price : "";
          let isAuctionOrReserve =
            currentPrice != "" &&
            token.sell_orders[0].closing_extendable == true;

          matchingToken.currentPrice = currentPrice;
          matchingToken.isAuctionOrReserve = isAuctionOrReserve;
          matchingToken.image_preview_url = token.image_preview_url;
          matchingToken.permalink = token.permalink;
        });

        let isFinalFetch = fetchResponses == requiredFetches;
        if (isFinalFetch) {
          calculateTraitsButton.disabled = false;
          updateSearchResultsHTML();
        }
      })
      .catch((err) => console.error(err));
  }
};

const updateSearchResultsHTML = () => {
  let shouldFilterByOpenseaOnly = openseaOnlyCheckbox.checked == true;
  let shouldFilterByBuyItNow = buyItNowOnlyCheckbox.checked == true;

  tokenScoresContainer.innerHTML = scoredTokensArray
    .filter((token, index) => {
      if (index + 1 > searchResultsContainer.value) {
        return false;
      }
      if (shouldFilterByOpenseaOnly) {
        if (token.permalink == undefined) {
          return false;
        }
      }
      if (shouldFilterByBuyItNow) {
        if (token.currentPrice == "" || token.isAuctionOrReserve) {
          return false;
        }
      }
      return true;
    })
    .map((token) => {
      return `<div onclick="handleCollapseOpenseaToken(this)" id="ID${
        token.tokenId
      }" class="opensea-token${
        token.currentPrice == "" ? "" : " current-price"
      }${token.isAuctionOrReserve ? " auction-or-reserve" : ""} ${
        token.permalink == undefined ? " not-on-opensea" : ""
      }">
      <div class="opensea-left-panel">
      <div class="opensea-info-wrapper">
      <div class="opensea-rank">#${token.rank}</div>
      <a class="opensea-id" href="${token.tokenURL}" target="_blank">ID #${
        token.tokenId
      }</div>
      </a>
      <div class="opensea-score">${
        Math.round(token.tokenScore * 100) / 100
      }</div>
      <img class="opensea-preview" src="${token.image_preview_url}">
      <div onclick="window.open('${
        token.permalink
      }','_blank');" class="opensea-price">${
        token.permalink == undefined
          ? "NOT MINTED"
          : token.currentPrice == ""
          ? "-"
          : `${
              Math.round(token.currentPrice * Math.pow(10, -18) * 100) / 100
            } ⧫`
      }<img src="./assets/opensea.svg" class="w-8 h-full"></div>
      </div>
      <div class="opensea-score-breakdown">
      ${token.tokenTraits
        .map((trait) => {
          return `
          <div class="opensea-score-breakdown-flex-wrapper">
          <div class="opensea-score-breakdown-trait">${trait.trait_type}</div>
          <div class="opensea-score-breakdown-value-flex-wrapper">
          <div class="opensea-score-breakdown-trait-value">${trait.value}</div>
          <div class="opensea-score-breakdown-score">${
            Math.round(trait.score * 100) / 100
          }</div>
          </div>
          </div>`;
        })
        .join("")}</div>
      </div>`;
    })
    .join("");
};

const scrollVerticallyTo = (el) => {
  const elLeft = el.offsetTop + el.offsetHeight;
  const elParentLeft = el.parentNode.offsetTop + el.parentNode.offsetHeight;

  if (elLeft >= elParentLeft + el.parentNode.scrollTop) {
    el.parentNode.scrollTop = elLeft - elParentLeft;
  } else if (elLeft <= el.parentNode.offsetTop + el.parentNode.scrollTop) {
    el.parentNode.scrollTop = el.offsetTop - el.parentNode.offsetTop;
  }

  el.style.backgroundColor = "yellow";
  el.style.scale = 2;

  setTimeout(() => {
    el.style.removeProperty("background-color");
  }, 3000);
};

const find = () => {
  let searchedElement = document.getElementById(
    `ID${openseaFindResultsId.value}`
  );
  if (searchedElement) {
    scrollVerticallyTo(searchedElement);
  }
};

const restoreInputs = () => {
  let lastPreset = localStorage.getItem("PRESETS");
  updateInputs(lastPreset);
};

const updateInputs = (projectName) => {
  switch (projectName) {
    case "Dark Horizon":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xD46814b736Db3C6FEeD576A59e3fF140075c9e0a";
      searchContainer.value = "https://www.darkhorizon.io/api/tokens/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "8686";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Sora's Dreamworld":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x4e2781e3aD94b2DfcF34c51De0D8e9358c69F296";
      searchContainer.value = "https://sorasdreamworld.io/tokens/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Cool Cats NFT":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x1A92f7381B9F03921564a437210bB9396471050C";
      searchContainer.value = "https://api.coolcatsnft.com/cat/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9932";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Pudgy Penguins":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xBd3531dA5CF5857e7CfAA92426877b022e612cf8";
      searchContainer.value = "https://api.pudgypenguins.io/penguin/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "8887";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Stoner Cats":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xD4d871419714B778eBec2E22C7c53572b573706e";
      searchContainer.value = "https://go.fission.app/json/REPLACE/index.json";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "10419";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Goons of Balatroon":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x8442DD3e5529063B43C69212d64D5ad67B726Ea6";
      searchContainer.value =
        "https://goons-metadata.herokuapp.com/api/token/REPLACE";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "9696";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Guardians of the metaverse":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x62cDAf466511888792c8C413239bAa70f57f1654";
      searchContainer.value = "https://metag-backend.herokuapp.com/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Bored Ape Yacht Club":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xBC4CA0EdA7647A8aB7C2061c2E118A18a936f13D";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmeSjSinHpPnmXmspMjwiXyN6zS4E9zccariGR3jxcaWtq/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Lucky Buddha Lucky Club":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x657F49b422f98B3092F27add6210831BF2e56622";
      searchContainer.value =
        "https://api.luckybuddhaluckyclub.io/buddha/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "5823";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Uninterested Unicorns":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xC4a0b1E7AA137ADA8b2F911A501638088DFdD508";
      searchContainer.value =
        "https://uunicorns.mypinata.cloud/ipfs/QmNmXi5PjWnf296wFNtbbqTDd5eLhX3U6z3n2Eo1xQbCwA/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "6900";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "The Moon Boyz":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xD8682bFA6918b0174F287b888e765b9A1b4dc9c3";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmWeM7kLga7FjxUb9CBv32xrRByj25Vxe4q61WPZwBHoHJ/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "11109";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Drunken Pandas":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x9BfA45382268E4BacbD1175395728153dC5248f2";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmQv2mYWRAAUogck6vxrXXxp7iBGbiWWJLLpxx77JcV2a6/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "3000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Galaxy Eggs":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xA08126f5E1ED91A635987071E6FF5EB2aEb67C48";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmfYJpMttwJQJr8v9r2Xu6hQkvLP2zo9CBRdPgHXCQgeoH/REPLACE.json";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9834";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Angry Boars":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xA66CC78067fd1E6Aa3eEC4CcdFF88D81527F92c1";
      searchContainer.value =
        "https://storage.googleapis.com/angry-boars/metadata/REPLACE.json";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "WALTZ":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xD58434F33a20661f186ff67626ea6BDf41B80bCA";
      searchContainer.value =
        "https://art-sandbox.sunflower.industries/token/0xd58434f33a20661f186ff67626ea6bdf41b80bca/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Clever Girl":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xc29b546b57bda23a83e4537eb6096fab30a54ea5";
      searchContainer.value =
        "https://clever-girls.s3.us-east-2.amazonaws.com/metadata/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "5554";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "BlankFace":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x06f8b41b72c04b2BbA587Fc7b09dbfb877cA7d04";
      searchContainer.value =
        "https://niftylabs.mypinata.cloud/ipfs/QmTJ9F6KNGo9sez1dErbkiXNwZJ4hYJJmps1zuRKpwKM1p/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "10000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Unusual Whales":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x1d81A6c7Ddc15b1553D49987c0286FaAe6734877";
      searchContainer.value =
        "https://gateway.pinata.cloud/ipfs/QmYqVXp5p1syvbPaHZeGKKe3vXz1wpntEotk1SQcyJMmS5/REPLACE";
      offsetTokenContainer.value = "-1";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "6968";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "I'm spottie":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xA0E1B198bCC877a950A29512ab5C0CE1Bb964c97";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmWSCfgE4RV4QNYijJ6nSPs8Dj432t1VKWcEvppEvJwg6R/REPLACE";
      offsetTokenContainer.value = "-4";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "2003";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "0xvampire":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xc9e2c9718fF7d3129B9Ac12168195507e4275Cea";
      searchContainer.value = "https://uri.0xvampire.com/api/0xvampire/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "9853";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Raccoon Secret Society":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x020BB206cd689d6981182579da490d5F4ceB4c46";
      searchContainer.value =
        "https://ipfs.io/ipfs/bafybeiai7vupouviw4ccwkagkmhylgktzm26vgtx7kdrdg5e75silyy6au/json/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "10000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Cupcats":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x8Cd8155e1af6AD31dd9Eec2cEd37e04145aCFCb3";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmVMBcNNpmnnXqcoimFRHTwqv4Neg4A3uUjcf4Q72QbqdK/metadata/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "4999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "BROADCASTERS":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x61598E2e6B012293CB6012b055ad77aA020e0206";
      searchContainer.value =
        "https://bcsnft.s3.us-east-2.amazonaws.com/meta-618dc2bf60b15/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "7776";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Evolved Apes Inc":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x233a65b06Ef83CCf2fd58832086dD782f9da1642";
      searchContainer.value = "https://api.evolvedapes.com/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9969";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "CryptoZoo.co":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xccee4d557588e982ECF3A2391d718c76589d8aF9";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmTvwMAxvkF1hVoKB5L1XtJWRGSXZBjCtbkWRUaDbjo8fy/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "4159";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "WE ARE THE OUTCAST":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x1C5Ed03149B1Fd5EFe12828A660C7B892c111bA4";
      searchContainer.value =
        "https://outkasts.s3.us-east-2.amazonaws.com/metadata/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "10000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "GOLDEN EAGLEZ KARTEL":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xaD086BF831fa18817e938953c9A882DeF9D3d552";
      searchContainer.value =
        "https://herodev.mypinata.cloud/ipfs/QmUBv8AVVD3bh76J364ATqL22ZsuWmovuY2kSKEkCovGqd/REPLACE.json";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "The Yakuza Cats Society":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x454cbc099079dc38b145e37e982e524af3279c44";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmNuChxuijmcDZ1JQE1NMPhZAtmu1QQgqUpN8TxVtXw4aH/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "8928";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Wanna Panda":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xE4A3cbfA0B27db2Def20BFba80905515b0855E54";
      searchContainer.value =
        "https://gateway.ipfs.io/ipfs/QmbkjG67a2if4dWB6BxBBFwaTnnmddcbKnMF5jR12Vq7wa/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "2845";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "The Humanoids":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x3a5051566b2241285BE871f650C445A88A970edd";
      searchContainer.value =
        "https://raw.githubusercontent.com/TheHumanoids/metadata/main/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "10000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "The Official Surreals":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xa406489360A47Af2C74fc1004316A64e469646A5";
      searchContainer.value =
        "https://surreals.mypinata.cloud/ipfs/QmWmiuEpxJiZ7uuBiGqcFFuFKk8UnfssMmuV9MQZaoB1wR/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "MekaVerse":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x9A534628B4062E123cE7Ee2222ec20B86e16Ca8F";
      searchContainer.value = "https://api.themekaverse.com/meka/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "8888";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "ETHEREALS WTF":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xfC778Be06c9A58f8f3e5E99216eFBB28f750Bc98";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmUXJYRgAxuofjc8AhCHihrB2fk8pGeNaFnzxCmRVqCMYU/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "12344";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "The Evolving Forest":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xd49eCCf40689095AD9e8334d8407f037E2cF5e42";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmcyrFG3obxaAM7tkzrw2AzdoGZfBohsris6jmYtT25Btj/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "9336";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Metaverse":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xF7143Ba42d40EAeB49b88DaC0067e54Af042E963";
      searchContainer.value =
        "https://mtsr.mypinata.cloud/ipfs/QmbbA4AVHkP9vZnQZ59VVj4LzmWGXbCd6Tpwg4MyR9kkdv/REPLACE.json";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "The Dreamers":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x10064373e248Bc7253653cA05Df73CF226202956";
      searchContainer.value =
        "https://dreamerapi.bitlectrolabs.com/dreamers/metadata/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "15000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "SlimHoods":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x2931B181Ae9Dc8F8109eC41C42480933F411ef94";
      searchContainer.value = "https://slimhoods.com/api/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "5000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "GORILLA CLUB NFT":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x3edC8437Dbe93104F402629208bceaB33DC35651";
      searchContainer.value =
        "https://us-central1-nft-project-2.cloudfunctions.net/nft/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "923";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Meta Legends":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value = "";
      searchContainer.value = "";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "12345";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Spectral Skellies":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x7a2e961C7Adc05F8352818274687b3dDa477DbaA";
      searchContainer.value = "https://www.spectralskellies.io/api/nft/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "3333";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "CreatureToadz":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xA4631A191044096834Ce65d1EE86b16b171D8080";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmSvp3SiR7RFLuvJQPMumtGykkbEMYDFqGHqy8DNgbmr1R/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "8888";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "RetroWaveDeers Collection":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x3627c7019D8A1b2E4296713A3156A6De8187986E";
      searchContainer.value =
        "https://raw.githubusercontent.com/retrometa/meta/master/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "7777";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "RareBunniClub":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xE63bE4Ed45D32e43Ff9b53AE9930983B0367330a";
      searchContainer.value =
        "https://link.us1.storjshare.io/raw/jxyychod33z67dadrigbd7yca2fa/rbpre/mpre/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "5499";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "OctoHedz":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x6da4c631C6AD8bFd9D7845Fd093541BEBecE2f96";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmYa2a74BAHnQLBj4xjbknXuNrAB3ww8nafMwjU6bUNqkC/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "8000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Womenandweapons":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x338866F8ba75bb9D7a00502E11b099a2636C2C18";
      searchContainer.value =
        "https://womenandweapons.mypinata.cloud/ipfs/QmVhxYgURKVnLWBm1aXH6BqKqFgmj7j1K5MWAFTkf9xm8N/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "10000";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Playboy Rabbitars Official":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x65C234D041F9ef96e2F126263727dfa582206d82";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmNnxVqvUf1rbwhbU1mdaBECkjHUUTpz3jLaZTPXk5n1pi/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "11952";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Divine Anarchy":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0xc631164B6CB1340B5123c9162f8558c866dE1926";
      searchContainer.value =
        "https://gateway.pinata.cloud/ipfs/QmeeL35t64Nmk7QCCrte9n2wn2D9M4LegYmsHoEiZSjW6c/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "10009";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Sipherian Flash":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x09E0dF4aE51111CA27d6B85708CFB3f1F7cAE982";
      searchContainer.value =
        "https://os.sipher.xyz/api/sipher/webhook/token-neko/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "9890";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Revealed";
      break;
    case "Villagers of XOLO":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x0000000005756B5a03E751bD0280e3A55BC05B6E";
      searchContainer.value =
        "https://villagers.planetxolo.workers.dev/nft/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "1";
      maxTokenContainer.value = "10350";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "March 20th 2pm PST";
      break;
    case "Cuddly Cubs":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x25cf8b17C0411Fbbc4E0926fDeFAb21Aad24b94F";
      searchContainer.value =
        "https://ipfs.io/ipfs/Qmc1iXRgxyJ7NWGqBJ8BFByaRiUX2snHBMnzx8WizJzzRH/REPLACE.json";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "Weekend of March 19th";
      break;
    case "BOOMGALA_Official":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x4b43C7A309a83E71471218AF76F71E45965C1129";
      searchContainer.value =
        "https://helloworld.mypinata.cloud/ipfs/QmRxWWJNspdWwXvL63buoLNiFQ41GtiSxDQQRBGrn2zcEz/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "6071";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "March 22nd";
      break;
    case "MPL Official":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x139732c3f717071843f90977D93400393BdF9664";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmSKwoRH5mfqjbF3rwHbhSLrxZaX7DrRhvfx127F6Wpord/REPLACE.json";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "March 20th 9pm UK";
      break;
    case "Timepiece Ape Society":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value =
        "0x139732c3f717071843f90977D93400393BdF9664";
      searchContainer.value =
        "https://ipfs.io/ipfs/QmWS1QLq6QM6yqqALCEEBpPD9vSGM9HM4jXSvVUeREVLt8/REPLACE";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "0";
      maxTokenContainer.value = "9999";
      apiDelayContainer.value = 5;
      revealDateContainer.value = "March 31st at 11:59PM EST";
      break;

    default:
    case "Custom":
      searchPresetsContainer.value = projectName;
      contractAddressContainer.value = "";
      searchContainer.value = "";
      offsetTokenContainer.value = "0";
      minTokenContainer.value = "";
      maxTokenContainer.value = "";
      apiDelayContainer.value = 5;
      break;
  }

  localStorage.setItem("PRESETS", searchPresetsContainer.value);
};

restoreInputs();

// temp1.findIndex((e) => { return e.tokenId == 973 })

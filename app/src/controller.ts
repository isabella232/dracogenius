var fullCards = {};
function CardSet(CardFetcher, $scope) {
  $scope.fullCards = fullCards;
  $scope.cards = [];
  $scope.search = "";
  $scope.limit = 20;

  function updateCardSubset() {
    $scope.limit = 20;
    var query = Query.parse($scope.search);
    $scope.cards = [];
    for (var name in $scope.fullCards) {
      var card = <Card> $scope.fullCards[name];
      if (query.match(card)) {
        $scope.cards.push(card);
      };
    }
  }

  var tagCardIndex = 0;
  $scope.chooseTagCard = () => {
    $scope.tagCard = null;
    for (;tagCardIndex < $scope.cards.length * 10; tagCardIndex++) {
      var card = $scope.cards[tagCardIndex % $scope.cards.length];
      if (card.tags.length === 0) {
        $scope.tagCard = card;
        break;
      }
    }
  }
  $scope.$watch("cards", () => {
    if (!$scope.tagCard) {
      $scope.chooseTagCard();
    }
  });
  $scope.$watch("tagCard", () => {
    if (!$scope.tagCard) {
      return;
    }
    $scope.tagCardTagString = $scope.tagCard.tags.join(", ");
  });
  $scope.tagEntered = () => {
    var tags = $scope.tagCardTagString
        .split(",")
        .map((tag:string) => tag.trim())
        .filter((tag:string) => tag.length > 0);
    console.log("tags:", tags);
    $scope.tagCard.tags = tags;
    CardFetcher.setTags($scope.tagCard, tags);

    tagCardIndex++;
    $scope.chooseTagCard();
  }

  $scope.onScrolledToBottom = function() {
    $scope.limit = Math.min($scope.limit + 20, $scope.cards.length);
  }

  $scope.$watch("search", updateCardSubset);
  $scope.$watch("fullCards", updateCardSubset);

  $scope.$watch("cards", () => {
    function makeHistograms(cards) {
      var cmcHistogram = {};
      var rarityHistogram = {};

      cards.forEach((card:Card) => {
        if (!(("" + card.cmc) in cmcHistogram)) {
          cmcHistogram[card.cmc] = 0;
        }
        cmcHistogram[card.cmc] +=1;
        card.printings.forEach((printing:CardPrinting) {
          if (!(printing.rarity in rarityHistogram)) {
            rarityHistogram[printing.rarity] = 0;
          }
          rarityHistogram[printing.rarity] +=1;
        });
      });
      var cmcHistogramKeyValues = objectToKeyValues(cmcHistogram);
      cmcHistogramKeyValues.sort((a, b) => {
        var aV = parseInt(a[0], 10) || -1;
        var bV = parseInt(b[0], 10) || -1;
        return aV - bV;
      });
      var rarityHistogramKeyValues = objectToKeyValues(rarityHistogram);
      rarityHistogramKeyValues.sort((a, b) => {
        var rarities = ["Land", "Common", "Uncommon", "Rare", "Mythic Rare"]
        var aV = rarities.indexOf(a[0]);
        var bV = rarities.indexOf(b[0]);
        return aV - bV;
      });
      $scope.cmcHistogram = cmcHistogramKeyValues;
      $scope.rarityHistogram = rarityHistogramKeyValues;
    }
    if ('then' in $scope.cards) {
      $scope.cards.then(makeHistograms);
    } else {
      makeHistograms($scope.cards);
    }
  });

  $scope.addCards = (cards: Card[]) => {
    cards.forEach((card:Card) {
      if (card.name in $scope.fullCards) {
        var potentiallyNewPrintings = card.printings;
        card = $scope.fullCards[card.name];
        // Add any new printings to card.printings
        potentiallyNewPrintings.forEach((printing:CardPrinting) {
          var found = false;
          card.printings.forEach((otherPrinting:CardPrinting) {
            found = found ||
                (printing.edition_id === otherPrinting.edition_id &&
                 printing.collectorsNumber === otherPrinting.collectorsNumber);
          });
          if (!found) {
            card.printings.push(printing);
          }
        });
      } else {
        $scope.fullCards[card.name] = card;
      }
    });
    updateCardSubset();
  };

  var activeSets = ["m13"]//, "isd", "rtr", "avr", "dka"];
  activeSets.forEach(function(set:string) {
    CardFetcher.getCards(set).then((cards) => {
      $scope.addCards(cards);
    });
  });
}

function objectToKeyValues(obj:Object) {
  var result = [];
  for (var key in obj) {
    result.push([key, obj[key]]);
  }
  return result;
}

angular.module('scroll', []).directive('whenScrolled', function() {
  return (scope, elm, attr) => {
    window.onscroll = () => {
      if (window.scrollY + window.innerHeight >=
          document.height - window.innerHeight) {
        scope.$apply(attr.whenScrolled);
      }
    };
  };
});

function randomPick(arr:any[]):any {
  if (arr.length === 0) {
    return undefined;
  }
  return arr[Math.round(Math.random() * (arr.length - 1))];
}

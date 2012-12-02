var fullCards = {};
function CardSet(CardFetcher:CardFetcher, $scope) {
  $scope.fullCards = fullCards;
  $scope.cards = [];
  $scope.search = "";
  $scope.limit = 20;
  $scope.mode = 'search';
  $scope.tags = CardFetcher.tags;

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

  $scope.addGroupTag = () => {
    var tags = parseTags($scope.groupTag);
    $scope.cards.forEach((card:Card) {
      card.tags = arrayUnion(card.tags, tags);
    });
    CardFetcher.updatedMultipleTags($scope.cards);
    makeHistograms($scope.cards);
  }
  $scope.removeGroupTag = () => {
   var tags = parseTags($scope.groupTag);
    $scope.cards.forEach((card:Card) {
      card.tags = arrayDifference(card.tags, tags);
    });
    CardFetcher.updatedMultipleTags($scope.cards);
    makeHistograms($scope.cards);
  }

  $scope.tagCardIndex = 0;
  $scope.$watch("cards", () => {
    if (!$scope.tagCard) {
      $scope.tagCard = null;
      for (;$scope.tagCardIndex < $scope.cards.length * 10; $scope.tagCardIndex++) {
        var card = $scope.cards[$scope.tagCardIndex % $scope.cards.length];
        if (card.tags.length === 0) {
          $scope.tagCard = card;
          break;
        }
      }
    }
  });
  $scope.$watch("tagCard", () => {
    if (!$scope.tagCard) {
      return;
    }
    $scope.tagCardTagString = $scope.tagCard.tags.join(", ");
  });
  function parseTags(tags:string):string[] {
    return tags.split(",")
        .map((tag:string) => tag.trim())
        .filter((tag:string) => tag.length > 0);
  }

  $scope.tagEntered = (event, delta) => {
    var tags = parseTags($scope.tagCardTagString);
    $scope.tagCard.tags = tags;
    CardFetcher.updatedTags($scope.tagCard);

    $scope.tagCardIndex += delta;
    if ($scope.tagCardIndex < 0) {
      $scope.tagCardIndex = $scope.cards.length + ($scope.tagCardIndex);
    }
    $scope.tagCard = $scope.cards[$scope.tagCardIndex % $scope.cards.length];
    makeHistograms($scope.cards);
  }

  $scope.onScrolledToBottom = function() {
    if ($scope.mode == 'search') {
      $scope.limit = Math.min($scope.limit + 20, $scope.cards.length);
    }
  }

  $scope.$watch("search", updateCardSubset);
  $scope.$watch("fullCards", updateCardSubset);

  function makeHistograms(cards) {
    var cmcHistogram = {};
    var rarityHistogram = {};
    var tagHistogram = {};

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
      card.tags.forEach((tag:string) {
        if (!(tag in tagHistogram)) {
          tagHistogram[tag] = 0;
        }
        tagHistogram[tag]++;
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
    $scope.tagHistogram = objectToKeyValues(tagHistogram)
                              .sort((a, b) => b[1] - a[1]);;
  }

  $scope.$watch("cards", () => {
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

  var activeSets = ["m13", "isd", "rtr", "avr", "dka"];
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

function arrayUnion(arr1:any[], arr2:any[]):any[] {
  return arr1.concat(arr2.filter((val) => arr1.indexOf(val) === -1));
}

function arrayDifference(arr1:any[], arr2:any[]):any[] {
  return arr1.filter((val) => arr2.indexOf(val) === -1);
}

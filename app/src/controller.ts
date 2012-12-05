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
    $scope.cards.sort((a:Card,b:Card) => {
      if (a.name === b.name) {
        return 0
      } else if(a.name < b.name) {
        return -1
      }
      return 1;
    });
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
          return;
        }
      }
      $scope.tagCard = $scope.cards[0];
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
    $scope.cmcHistogram = new CMCFacet().getHistogram(cards);
    $scope.rarityHistogram = new RarityFacet().getHistogram(cards);
    $scope.tagHistogram = new TagFacet().getHistogram(cards);
    $scope.colorHistogram = new ColorFacet().getHistogram(cards);
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

  $scope.$watch('viewStyle', () => {
    console.log($scope.viewStyle);
  });

  var activeSets = [sets["Core Set Editions"][0]].concat(sets["Innistrad Cycle"]).concat(sets["Return to Ravnica"]);
  activeSets.forEach(function(setData:string[]) {
    var set = setData[0];
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

var fullCards = {};
function CardSet(CardFetcher, $scope) {
  $scope.fullCards = fullCards;
  $scope.cards = [];
  $scope.search = "";

  function updateCardSubset() {
    var query = Query.parse($scope.search);
    $scope.cards = [];
    for (var name in $scope.fullCards) {
      var card = <Card> $scope.fullCards[name];
      if (query.match(card)) {
        $scope.cards.push(card);
      };
    }
  }

  $scope.$watch("search", updateCardSubset);
  $scope.$watch("fullCards", updateCardSubset);

  $scope.$watch("cards", () => {
    function makeHistograms(cards) {
      var cmcHistogram = {

      };

      cards.forEach((card) => {
        if (!(card.cmc in cmcHistogram)) {
          cmcHistogram[card.cmc] = 0;
        }
        cmcHistogram[card.cmc] +=1;
      });
      var cmcHistogramKeyValues = objectToKeyValues(cmcHistogram);
      cmcHistogramKeyValues.sort((a, b) => {
        var aV = parseInt(a[0], 10) || -1;
        var bV = parseInt(b[0], 10) || -1;
        return aV - bV;
      });
      $scope.cmcHistogram = cmcHistogramKeyValues;
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

  var activeSets = ["m13", "isd", "rtr", "avr"];
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

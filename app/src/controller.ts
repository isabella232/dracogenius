function CardSet(CardFetcher, $scope) {
  $scope.fullCards = CardFetcher.getCards();
  $scope.cards = $scope.fullCards;
  $scope.$watch("regex", () => {
    var r = new RegExp($scope.regex, "i");
    Query.parse($scope.regex);
    $scope.fullCards.then((fullCards:Card[]) => {
      var result = [];
      fullCards.forEach((card:Card) {
        if (card.rawHtml.match(r)) {
          result.push(card);
        }
      });
      $scope.cards = result;
    })
  });

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
}

function objectToKeyValues(obj:Object) {
  var result = [];
  for (var key in obj) {
    result.push([key, obj[key]]);
  }
  return result;
}

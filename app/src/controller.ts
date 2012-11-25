function CardSet(CardFetcher, $scope) {
  $scope.cards = CardFetcher.getCards();
}

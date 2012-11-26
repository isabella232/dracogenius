describe("Query Parser", function() {
  var examples = [
    [
      "should match anything with an empty query",
      "",
      allCards.map(function(card){return card.name;}),
      []
    ],
    [
      "should match simple text in an ability",
      "deathtouch",
      ["Acidic Slime", "Deadly Recluse"],
      ["Ajani's Sunstriker", "Disciple of Bolas"]
    ],
    [
      "should accept t:type queries",
      "t:Creature",
      ["Ajani's Sunstriker"],
      ["Akroma's Memorial"]
    ]
  ];

  beforeEach(function() {
    this.addMatchers({
      shouldMatch: function(cardName) {
        var query = Query.parse(this.actual);
        this.message = function() {
          return ("Search `" + this.actual +
                  "` should" + (this.isNot ? "n't" : "") + " match the card `" + cardName + "`");
        }
        return query.match(cardsByName[cardName]);
      }
    });
  });

  examples.forEach(function(example) {
    it(example[0], function() {
      var source = example[1];
      var acceptables = example[2];
      var rejectables = example[3];
      var query = Query.parse(source);
      acceptables.forEach(function(acceptable) {
        expect(source).shouldMatch(acceptable);
      });
      rejectables.forEach(function(rejectable) {
        expect(source).not.shouldMatch(rejectable);
      })
    });
  });
});


describe("Parser Tests", function() {
  it("should parse t:any", function() {
    var identifier = withJoin(repeat1(range("A","z")));

    var quoted = withAction(
      sequence([ch('"'), withJoin(repeat(negate(ch('"')))), ch('"')]),
      function(ast) { return ast[1]; });

    var p = withAction(
      sequence([token("t:"), choice([quoted, identifier])]),
      function(ast) {return new TypeQuery(ast[1])}
    );
    var input = ps('t:"abc def"');

    expect(p(input).ast).toEqual(new TypeQuery("abc def"))
  });
});

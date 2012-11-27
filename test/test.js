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
    ],
    [
      "should ignore case when matching on type",
      "t:creature",
      ["Ajani's Sunstriker"],
      ["Akroma's Memorial"]
    ],
    [
      "should treat each word in a search separately, matching on all of them",
      "ajani lifelink",
      ["Ajani's Sunstriker"],
      ["Ajani, Caller of the Pride", "Glorious Charge"]
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
    var word = withJoin(repeat1(negate(choice([" ", "\t", "\n"].map(ch)))));

    var quoted = withAction(
      sequence([ch('"'), withJoin(repeat(negate(ch('"')))), ch('"')]),
      function(ast) { return ast[1]; });

    var search_token = choice([quoted, word]);

    var typeSearch = withAction(
      sequence([token("t:"), search_token]),
      function(ast) {return new TypeQuery(ast[1])}
    );

    var normalSearch = withAction(search_token, function(str) {
      return new RegexQuery(str);
    });

    var singleSearchTerm = whitespace(choice([typeSearch, normalSearch]));

    var searchCombiner = withAction(repeat(singleSearchTerm),
      function (terms) {
        return terms;
      }
    );

    var input = ps('ajani lifelink');

    //expect(searchCombiner(input).ast).toEqual([]);//new RegexQuery('lol'), new TypeQuery("abc def"), new RegexQuery('butts')])
    });
});

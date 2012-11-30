cardsByName['Acidic Slime'].tags = ['threat', 'answer'];

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
    ],
    [
      "regular text searches should also match tags",
      "answer",
      ["Acidic Slime", "Index", "Unsummon"],
      ["Ajani's Sunstriker"]
    ],
    [
      "tag searches shouldn't match cards with the query in their text",
      "tag:answer",
      ["Acidic Slime"],
      ["Index", "Unsummon", "Ajani's Sunstriker"]
    ],
    [
      "artis searches shouldn't match cards with the query in their test",
      "a:kie",
      ["Arctic Aven"],
      ["Mogg Flunkies"]
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
      });
    });
  });
});

describe("Card.parseCardHtml", function() {
  var examples = [
    [
       "Azor's Elocutors",
       {
         castingCost: "3{W/U}{W/U}",
         cmc: 5
       }
    ],
    [
      "Yeva, Nature's Herald",
      {
        castingCost: "2GG",
        cmc: 4,
      }
    ],
    [
      "Garruk Relentless",
      {
        printings: {
          collectorsNumber: "181a",
          illustrator: "Eric Deschamps",
          rarity: "Mythic Rare"
        }
      }
    ],
    [
      "Arctic Aven",
      {
        printings: {
          illustrator: "Igor Kieryluk"
        }
      }
    ]
  ]
  examples.forEach((ex) => {
    var name = ex[0];
    var properties = ex[1];

    objForEach(properties, (key, value) => {
      if (key === "printings") {
        it("should parse `" + name + "` as having a printing with values " +
           value, () => {
          var card = <Card>cardsByName[name];
          expect(card.printings.length).toBe(1); // this test will need more
                                                 // work to support multiple
                                                 // printings
          var printing = card.printings[0];
          objForEach(value, (key, pr_value) => {
            expect(printing[key]).toEqual(pr_value);
          });
        })
      } else {
        it("should parse `" + name + "`s " + key + " as " + value, () => {
          expect(cardsByName[name][key]).toEqual(value);
        });

      }
    });
  });
});

function objForEach(obj:Object, f:(key:string, val:any)=>void) {
  for (var key in obj) {
    f(key, obj[key]);
  };
}

describe("Learning jsparse.js Tests", function() {
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

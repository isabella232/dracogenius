function getCardRawHtml(set="m13") {
  var url = "http://magiccards.info/query?q=e%3A" + set + "%2Fen&v=spoiler"
  return GETCached(url);
}

function getCards() {
  return getCardRawHtml().then((html) => {
    return html
      .match(/<td valign="top" width="25%">[^]+?<\/td>/gm)
      .map((cardHtml) => {
        var r = /<span style="font-size: 1.2em;"><a href="(.*?(\d+))\.html">(.*?)<\/a><\/span>/;
        var match = cardHtml.match(r);
        var name = match[3];
        var id = match[1];
        var collectorsNumber = parseInt(match[2]);
        r = /<p><img src="http:\/\/magiccards.info\/images\/en.gif" alt="English" width="16" height="11" class="flag2"> (.*?), <i>(.*?)<\/i><\/p>/;
        match = cardHtml.match(r);
        var edition = match[1];
        var rarity = match[2];
        r = /<p>(.*?), [\s\n]+ (X*[\dBWUGR]+)?( \((\d+)\))?<\/p>/;
        match = cardHtml.match(r);
        var type = match[1];
        var castingCost = match[2];
        var cmc = parseInt(match[4], 10);
        if (isNaN(cmc)) {
          cmc = null;
        }
        r = /<p class="ctext"><b>(.*?)<\/b><\/p>/;
        match = cardHtml.match(r);
        var abilities = [];
        if (match) {
          abilities = match[1].split("<br><br>");
        }
        r = /<p><i>(.*?)<\/i><\/p>/
        match = cardHtml.match(r);
        var flavorText = match[1];
        r = /<p>Illus. (.*?)<\/p>/
        match = cardHtml.match(r);
        var illustrator = match[1];
        var card = new Card(name);
        card.rawHtml = cardHtml;
        card.abilities = abilities;
        card.castingCost = castingCost;
        card.cmc = cmc;
        card.type = type;
        card.printings.push({
          id: id,
          edition: edition,
          rarity: rarity,
          flavorText: flavorText,
          illustrator: illustrator,
          collectorsNumber: collectorsNumber
        });
        return card;
      });
  });
}



function logger(v) {
  console.log(v);
}

function GETCached(url, options={}) {
  var cacheKey = "cache:" + url;
  return getFromStorage(cacheKey).then(
    (val)=>val,
    ()=> {
      var p = GET(url, options);
      p.then((text) => setInStorage(cacheKey, text))
      return p;
    }
  );
}

function getFromStorage(key:string) {
  var deferred = Q.defer();
  chrome.storage.local.get(key, function(result) {
    if (key in result) {
      deferred.resolve(result[key]);
    } else {
      deferred.reject();
    }
  });
  return deferred.promise;
}

function setInStorage(key, value) {
  var setObj = {};
  setObj[key] = value;
  chrome.storage.local.set(setObj);
}

function GET(url, options) {
  var deferred = Q.defer();
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  if (options.base64) {
    request.overrideMimeType("text/plain; charset=x-user-defined");
  }
  request.send();

  request.onload = function() {
    if (options.base64) {
      deferred.resolve(btoa(unescape(encodeURIComponent(request.responseText))));
    } else {
      deferred.resolve(request.responseText);
    }
  }
  return deferred.promise;
}

function CardSet($scope) {
  $scope.cards = {};

  $scope.addCards = function(cards:Card[]) {
    $scope.$apply(() => {
      cards.slice(0,1).forEach((card:Card) {
        if (card.name in $scope.cards) {
          console.log("got another card with the same name!");
          //TODO(combine the printings)
        } else {
          $scope.cards[card.name] = card;
        }
      });
    })
  }

  getCards().then(function(c) {
    $scope.addCards(c);
  }).done();

  $scope.$watch("regex", () => {
    $scope.unmatched = [];
    $scope.matched = [];
    if ($scope.regex === "") {
      return;
    }
    var regex = new RegExp($scope.regex);
    for (var name in $scope.cards) {
      var card = $scope.cards[name];
      var match = card.rawHtml.match(regex);
      if (match) {
        $scope.matched.push(JSON.stringify(match, null, 2));
      } else {
        if ($scope.unmatched.length < 2) {
          $scope.unmatched.push(JSON.stringify(card, null, 2));
        }
      }
    }
  });
}


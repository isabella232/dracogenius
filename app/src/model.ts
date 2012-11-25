interface CardPrinting {
  edition_id: string;
  edition: string;
  rarity: string;
  collectorsNumber: number;
  flavorText: string;
  illustrator: string;
};

class Card {
  rawHtml : string;
  name: string;
  printings: CardPrinting[] = [];
  abilities: string[];
  castingCost: string;
  cmc: number;
  type: string;

  constructor(name:string, private CardFetcher:CardFetcher) {
    this.name = name;
  }

  get image() {
    if (!('_image' in this)) {
      this['_image'] = this.CardFetcher.getCardImage(this);
    }
    return this['_image'];
  }

  get link() {
    var printing = this.printings[0];
    return "http://magiccards.info/" + printing.edition_id + "/en/" + printing.collectorsNumber;
  }

  toJson() {
    var obj = angular.copy(this);
    delete obj.rawHtml;
    console.log(obj);
    return JSON.stringify(obj, null, 2);
  }
}

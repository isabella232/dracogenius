// Copyright (C) 2007 Chris Double.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice,
//    this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESS OR IMPLIED WARRANTIES,
// INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND
// FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
// DEVELOPERS AND CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
// PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS;
// OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
// WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR
// OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
// ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

interface ParseResult {
   remaining: ParseState;
   matched: string;
   ast: any; // until I grok it better
}

interface Parser {
   (state: ParseState): ParseResult;
}

class ParseState {
    input: string;
    index: number;
    length: number;

    constructor (input: string, index=0) {
        this.input = input;
        this.index = index;
        this.length = input.length - this.index;
    }

    from (index: number): ParseState {
        var r = new ParseState(this.input, this.index + index);
        r.length = this.length - index;
        return r
    }

    substring (start: number, end: number): string {
        return this.input.substring(start + this.index, end + this.index)
    }

    trimLeft (): ParseState {
        var s: string = this.substring(0, this.length);
        var m: string[] = s.match(/^\s+/);
        return m ? this.from(m[0].length) : this
    }

    at (index: number): string {
        return this.input.charAt(this.index + index)
    }

    toString (): string {
        return 'PS"' + this.substring(0, this.length) + '"'
    }
}

function ps (str: string): ParseState {
    return new ParseState(str)
}

function make_result (r: ParseState, matched: string, ast: any): ParseResult {
    return { remaining: r, matched: matched, ast: ast }
}

// Parses a string. The AST contains the string that was parsed.
function token (s: string): Parser {
    return function (state: ParseState): ParseResult {
        if (state.length >= s.length && state.substring(0, s.length) == s)
            return { remaining: state.from(s.length), matched: s, ast: s };
        else
            return null;
    };
}

// Matches a single specific character.
function ch (c: string): Parser {
    return range(c, c)
}

// Matches a single character in an inclusive range ("a" to "z" for example).
// The AST contains the single-character string that was parsed.
function range (lower: string, upper: string): Parser {
    return function (state: ParseState): ParseResult {
        if(state.length < 1)
            return null;
        else {
            var ch: string = state.at(0);
            if(ch >= lower && ch <= upper)
                return { remaining: state.from(1), matched: ch, ast: ch }
            else
                return null
        }
    };
}

// Negate a single character parser. So negate(range('a', 'z')) will
// match anything except the characters in the range.
function negate (p: Parser): Parser {
    return function (state: ParseState): ParseResult {
        if(state.length >= 1) {
            var r = p(state);
            if(!r)
                return make_result(state.from(1), state.at(0), state.at(0));
            else
                return null;
        }
        else {
            return null;
        }
    };
}

// Skips whitespace and then matches p.
function whitespace (p: Parser): Parser {
    return function (state: ParseState) {
        return p(state.trimLeft())
    };
}

// As p, except that the AST that results is transformed by f.
function withAction (p: Parser, f): Parser {
    return function (state: ParseState): ParseResult {
        var x: ParseResult = p(state);
        if (x) {
            x.ast = f(x.ast);
            return x;
        }
        else {
            return null;
        }
    };
}

// Combine a parser with an action which applies array "join" with an empty separator.
function withJoin (p: Parser): Parser {
    return withAction(p, function (ast) { return ast.join('') })
}

function foldl (f, initial, seq) {
    for (var i = 0; i < seq.length; ++i) {
        initial = f(initial, seq[i]);
    }
    return initial;
}

// Given an AST of the form [ Expression, [ a, b, ...] ], convert to
// [ [ [ Expression [ a ] ] b ] ... ]
// This is used for handling left recursive entries in the grammar. e.g.
// MemberExpression:
//   PrimaryExpression
//   FunctionExpression
//   MemberExpression [ Expression ]
//   MemberExpression . Identifier
//   new MemberExpression Arguments
function leftFactor (ast) {
    return foldl(function (v, action) { return [ v, action ] }, ast[0], ast[1])
}

// Left factors the AST result of another parser.
function withLeftFactor (p: Parser): Parser {
    return withAction(p, leftFactor);
}

// Matches empty string, i.e. end of input.
function end_p (state: ParseState): ParseResult {
    if(state.length == 0)
        return make_result(state, undefined, undefined);
    else
        return null;
}

// Always fails without consuming any input.
function nothing_p (state: ParseState): ParseResult {
    return null;
}

// Succeeds only if all the parsers in the supplied sequence succeed. Builds
// an array of their ASTs.
function sequence (ps: Parser[]): Parser {
    return function (state: ParseState): ParseResult {
        var ast = [];
        var matched: string = "";
        var i;
        for(var i: number = 0; i< ps.length; ++i) {
            var parser: Parser = ps[i];
            var result: ParseResult = parser(state);
            if (result) {
                state = result.remaining;
                if (result.ast != undefined) {
                    ast.push(result.ast);
                    matched = matched + result.matched;
                }
            }
            else {
                break;
            }
        }
        if (i == ps.length) {
            return make_result(state, matched, ast);
        }
        else
            return null;
    };
}

// Like sequence, but ignores whitespace between individual parsers.
// TODO: this looks wrong.
function wsequence (ps: Parser[]): Parser {
    return sequence.apply(null, ps);
}

// Tries each of the given parsers in order. The first one that succeeds
// results in a successful parse. It fails only if all parsers fail.
function choice (ps: Parser[]): Parser {
    return function (state: ParseState): ParseResult {
        var result: ParseResult;
        for(var i: number = 0; i < ps.length; ++i) {
            result = ps[i](state);
            if (result) {
                break
            }
        }
        if (i == ps.length)
            return null
        else
            return result
    }
}

// Succeeds if p1 matches and p2 does not, or p1 matches and the
// matched text is longer than p2's.  Useful for things like:
// butnot(IdentifierName, ReservedWord)
function butnot (p1: Parser, p2: Parser): Parser {
    return function(state: ParseState): ParseResult {
        var br: ParseResult = p2(state);
        if (!br) {
            return p1(state);
        } else {
            var ar: ParseResult = p1(state);

            if (ar) {
              if (ar.matched.length > br.matched.length)
                  return ar;
              else
                  return null;
            }
            else {
              return null;
            }
        }
    }
}

// Succeeds if p1 matches and p2 does not. If both match then if
// p2's matched text is shorter than p1's it is successful.
function difference (p1: Parser, p2: Parser): Parser {
    return function (state: ParseState): ParseResult {
        var br = p2(state);
        if(!br) {
            return p1(state);
        } else {
            var ar = p1(state);
            if (ar.matched.length >= br.matched.length)
                return br;
            else
                return ar;
        }
    }
}

// Succeeds if p1 or p2 match but fails if they both match.
function xor (p1: Parser, p2: Parser): Parser {
    return function (state: ParseState): ParseResult {
        var ar = p1(state);
        var br = p2(state);
        if(ar && br)
            return null;
        else
            return ar || br;
    }
}

// Zero or more matches of another parser.
function repeat (p: Parser): Parser {
    return optional(repeat1(p));
}

// One or more matches of another parser. Builds an array of their results.
function repeat1 (p: Parser): Parser {
    return function(state: ParseState): ParseResult {
        var ast = [];
        var matched: string = "";
        var result: ParseResult = p(state);
        if(!result)
            return null;
        else {
            while(result) {
                ast.push(result.ast);
                matched = matched + result.matched;
                if(result.remaining.index == state.index)
                    break;
                state = result.remaining;
                result = p(state);
            }
            return make_result(state, matched, ast);
        }
    }
}

// Zero or one match of another parser.
function optional (p: Parser): Parser {
    return function (state: ParseState): ParseResult {
        return p(state) || epsilon_p(state)
    }
}

// Ensures that the given parser succeeds but ignores its result. This
// can be useful for parsing literals that you don't want to appear in
// the AST. eg: sequence(expect("("), Number, expect(")")) => ast: Number
function expect_p (p: Parser): Parser {
    return withAction(p, (ast) => undefined)
}

// This isn't quite the same as sequence([expect(p1), p, expect(p2)]), which produces a
// singleton array with the result of p in it.
function between (p1: Parser, p: Parser, p2: Parser): Parser {
    return withAction(sequence([p1, p, p2]), (ast) => ast[1])
}

function chain (p: Parser, s: Parser, f): Parser {
    return withAction(sequence([p, repeat(withAction(sequence([s, p]), f))]),
                      (ast) => [ast[0]].concat(ast[1]))
}

// A parser combinator to do left chaining. Like 'chain', it expects parsers for items and for
// a separator. The separator parser's AST result should be a binary function taking (lhs,rhs)
// to the result of applying some operation to the lhs and rhs AST's from the item parser.
function chainl (p: Parser, s: Parser): Parser {
    return withAction(sequence([p, repeat(sequence([s, p]))]),
                      (ast) => foldl((v, action) => action[0](v, action[1]), ast[0], ast[1]))
}

// Matches lists of things. The parser to match the list item and the
// parser to match the separator need to be provided. The AST is the
// array of matched items.
function list (p: Parser, s: Parser): Parser {
    return chain(p, s, (ast) => ast[1])
}

// Similar to list, but ignores whitespace between individual parsers.
function wlist (ps: Parser[]): Parser {
    var parsers = [];
    for (var i=0; i < ps.length; ++i) {
        parsers.push(whitespace(ps[i]))
    }
    return list.apply(null, parsers)
}

// A parser that always returns a zero length match
function epsilon_p (state) {
    return make_result(state, "", undefined)
}

// Allows attaching of a function anywhere in the grammar. If the function returns
// true then parse succeeds otherwise it fails. Can be used for testing if a symbol
// is in the symbol table, etc.
function semantic (f) {
    return function (state: ParseState): ParseResult {
        return f() ? epsilon_p(state) : null
    }
}

// Asserts that a certain conditional syntax is satisfied before
// evaluating another production. Eg: sequence(and("0"), oct_p) (if a
// leading zero, then parse octal) It succeeds if 'p' succeeds and
// fails if 'p' fails. It never consume any input however, and doesn't
// put anything in the resulting AST.
function and (p: Parser): Parser {
    return function(state: ParseState): ParseResult {
        return p(state) ? epsilon_p(state) : null
    }
}

// The opposite of 'and'. It fails if 'p' succeeds and succeeds if
// 'p' fails. It never consumes any input. This combined with 'and' can
// be used for 'lookahead' and disambiguation of cases.
//
// Compare:
// sequence("a",choice("+","++"),"b")
//   parses a+b
//   but not a++b because the + matches the first part and peg's don't
//   backtrack to other choice options if they succeed but later things fail.
//
// sequence("a",choice(sequence("+", not("+")),"++"),"b")
//    parses a+b
//    parses a++b
//
function not (p: Parser): Parser {
    return function (state: ParseState): ParseResult {
        return p(state) ? null : epsilon_p(state)
    }
}

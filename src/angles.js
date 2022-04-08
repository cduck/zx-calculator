import {
  simplify,
  parse,
  OperatorNode,
  ConstantNode,
  SymbolNode,
} from "mathjs";

export const ANGLE_ZERO = "0";
export const ANGLE_PI = "π";
export const ANGLE_PI_DIV2 = "π/2";
export const ANGLE_PI_DIVN2 = "-π/2";

const STR_OPS = { notation: "fixed" };

// List of LaTeX symbol variable names from
// https://gist.github.com/Metaxal/86be1b733c0f5ad4a0cf6c58cf140436
// which was adapted from
// anaconda/lib/python2.7/site-packages/docutils/utils/math/tex2unichar.py
// which was generated from `write_tex2unichar.py` with
// http://milde.users.sourceforge.net/LUCR/Math/
// prettier-ignore
export const MATH_ALPHA = {
  Bbbk:       "𝕜", // \U0001d55c MATHEMATICAL DOUBLE-STRUCK SMALL K
  Delta:      "Δ", // \u0394 GREEK CAPITAL LETTER DELTA
  Gamma:      "Γ", // \u0393 GREEK CAPITAL LETTER GAMMA
  Im:         "ℑ", // \u2111 BLACK-LETTER CAPITAL I
  Lambda:     "Λ", // \u039b GREEK CAPITAL LETTER LAMDA
  Omega:      "Ω", // \u03a9 GREEK CAPITAL LETTER OMEGA
  Phi:        "Φ", // \u03a6 GREEK CAPITAL LETTER PHI
  Pi:         "Π", // \u03a0 GREEK CAPITAL LETTER PI
  Psi:        "Ψ", // \u03a8 GREEK CAPITAL LETTER PSI
  Re:         "ℜ", // \u211c BLACK-LETTER CAPITAL R
  Sigma:      "Σ", // \u03a3 GREEK CAPITAL LETTER SIGMA
  Theta:      "Θ", // \u0398 GREEK CAPITAL LETTER THETA
  Upsilon:    "Υ", // \u03a5 GREEK CAPITAL LETTER UPSILON
  Xi:         "Ξ", // \u039e GREEK CAPITAL LETTER XI
  aleph:      "ℵ", // \u2135 ALEF SYMBOL
  alpha:      "α", // \u03b1 GREEK SMALL LETTER ALPHA
  beta:       "β", // \u03b2 GREEK SMALL LETTER BETA
  beth:       "ℶ", // \u2136 BET SYMBOL
  chi:        "χ", // \u03c7 GREEK SMALL LETTER CHI
  daleth:     "ℸ", // \u2138 DALET SYMBOL
  delta:      "δ", // \u03b4 GREEK SMALL LETTER DELTA
  digamma:    "Ϝ", // \u03dc GREEK LETTER DIGAMMA
  ell:        "ℓ", // \u2113 SCRIPT SMALL L
  epsilon:    "ϵ", // \u03f5 GREEK LUNATE EPSILON SYMBOL
  eta:        "η", // \u03b7 GREEK SMALL LETTER ETA
  eth:        "ð", // \u00f0 LATIN SMALL LETTER ETH
  gamma:      "γ", // \u03b3 GREEK SMALL LETTER GAMMA
  gimel:      "ℷ", // \u2137 GIMEL SYMBOL
  hbar:       "ℏ", // \u210f PLANCK CONSTANT OVER TWO PI
  hslash:     "ℏ", // \u210f PLANCK CONSTANT OVER TWO PI
  imath:      "ı", // \u0131 LATIN SMALL LETTER DOTLESS I
  iota:       "ι", // \u03b9 GREEK SMALL LETTER IOTA
  jmath:      "ȷ", // \u0237 LATIN SMALL LETTER DOTLESS J
  kappa:      "κ", // \u03ba GREEK SMALL LETTER KAPPA
  lambda:     "λ", // \u03bb GREEK SMALL LETTER LAMDA
  mu:         "μ", // \u03bc GREEK SMALL LETTER MU
  nu:         "ν", // \u03bd GREEK SMALL LETTER NU
  omega:      "ω", // \u03c9 GREEK SMALL LETTER OMEGA
  phi:        "ϕ", // \u03d5 GREEK PHI SYMBOL
  pi:         "π", // \u03c0 GREEK SMALL LETTER PI
  psi:        "ψ", // \u03c8 GREEK SMALL LETTER PSI
  rho:        "ρ", // \u03c1 GREEK SMALL LETTER RHO
  sigma:      "σ", // \u03c3 GREEK SMALL LETTER SIGMA
  tau:        "τ", // \u03c4 GREEK SMALL LETTER TAU
  theta:      "θ", // \u03b8 GREEK SMALL LETTER THETA
  upsilon:    "υ", // \u03c5 GREEK SMALL LETTER UPSILON
  varDelta:   "𝛥", // \U0001d6e5 MATHEMATICAL ITALIC CAPITAL DELTA
  varGamma:   "𝛤", // \U0001d6e4 MATHEMATICAL ITALIC CAPITAL GAMMA
  varLambda:  "𝛬", // \U0001d6ec MATHEMATICAL ITALIC CAPITAL LAMDA
  varOmega:   "𝛺", // \U0001d6fa MATHEMATICAL ITALIC CAPITAL OMEGA
  varPhi:     "𝛷", // \U0001d6f7 MATHEMATICAL ITALIC CAPITAL PHI
  varPi:      "𝛱", // \U0001d6f1 MATHEMATICAL ITALIC CAPITAL PI
  varPsi:     "𝛹", // \U0001d6f9 MATHEMATICAL ITALIC CAPITAL PSI
  varSigma:   "𝛴", // \U0001d6f4 MATHEMATICAL ITALIC CAPITAL SIGMA
  varTheta:   "𝛩", // \U0001d6e9 MATHEMATICAL ITALIC CAPITAL THETA
  varUpsilon: "𝛶", // \U0001d6f6 MATHEMATICAL ITALIC CAPITAL UPSILON
  varXi:      "𝛯", // \U0001d6ef MATHEMATICAL ITALIC CAPITAL XI
  varepsilon: "ε", // \u03b5 GREEK SMALL LETTER EPSILON
  varkappa:   "𝜘", // \U0001d718 MATHEMATICAL ITALIC KAPPA SYMBOL
  varphi:     "φ", // \u03c6 GREEK SMALL LETTER PHI
  varpi:      "ϖ", // \u03d6 GREEK PI SYMBOL
  varrho:     "ϱ", // \u03f1 GREEK RHO SYMBOL
  varsigma:   "ς", // \u03c2 GREEK SMALL LETTER FINAL SIGMA
  vartheta:   "ϑ", // \u03d1 GREEK THETA SYMBOL
  wp:         "℘", // \u2118 SCRIPT CAPITAL P
  xi:         "ξ", // \u03be GREEK SMALL LETTER XI
  zeta:       "ζ", // \u03b6 GREEK SMALL LETTER ZETA
};

const ESCAPE_RE = /\\?([a-zA-Z]+)/g;

export const DEFAULT_SUGGESTIONS = [
  { value: "0" },
  { value: "π/4" },
  { value: "π/2" },
  { value: "3π/4" },
  { value: "π" },
  { value: "-3π/4" },
  { value: "-π/2" },
  { value: "-π/4" },
];

export const isZero = (prettyStr) => {
  return prettyStr === ANGLE_ZERO;
};
export const isPi = (prettyStr) => {
  return prettyStr === ANGLE_PI;
};
export const isPiDiv2 = (prettyStr) => {
  return prettyStr === ANGLE_PI_DIV2;
};
export const isPiDivN2 = (prettyStr) => {
  return prettyStr === ANGLE_PI_DIVN2;
};

export const cleanInputStr = (str) => {
  if (!str) {
    str = "0";
  }
  // Substitute Greek letter backslash escapes
  str = str.replace(ESCAPE_RE, (m0, m1) => MATH_ALPHA[m1] || m0);
  // Reject disallowed characters
  if (str.search(/[!"#$%',:;<=>?@[\\\]`{|}~]/) >= 0) {
    throw { message: "angle has invalid characters" };
  }
  // Normalize
  return expressionToPretty(parse(prettyStrToParsable(str)));
};

const prettyStrToParsable = (str) => {
  // Replace any Unicode π with "pi" (spaces to allow "aπ" = "a*pi")
  str = str.replace(/[π𝝅𝝿𝞹]/gu, " pi ");
  str = str.replace(/[·]/gu, " * ");
  return str;
};

const simplifyAndWrapExpr = (str) => {
  let simp = simplify(str, { context: simplify.realContext });
  if (simp.op === "+" || simp.op === "-") {
    for (let i = 0; i < simp.args.length; i++) {
      simp.args[i] = wrapExprToPlusMinusPi(simp.args[i]);
    }
  } else {
    simp = wrapExprToPlusMinusPi(simp);
  }
  return simplify(simp.toString(STR_OPS), {
    context: simplify.realContext,
  });
};
const divPiExpr = (expr) => {
  return new OperatorNode(
    "/",
    "divide",
    [expr, new SymbolNode("pi")],
    false,
    false
  );
};
const mulPiExpr = (expr) => {
  return new OperatorNode(
    "*",
    "multiply",
    [expr, new SymbolNode("pi")],
    false,
    false
  );
};
const wrapExprToPlusMinusPi = (expr) => {
  try {
    const val = Math.ceil(divPiExpr(expr).evaluate());
    if (val === 0 || val === 1) {
      return expr;
    }
    const correction = -Math.floor(val / 2) * 2;
    if (isFinite(correction)) {
      return new OperatorNode(
        "+",
        "add",
        [expr, mulPiExpr(new ConstantNode(correction))],
        false,
        false
      );
    }
    return expr;
  } catch (e) {
    return expr;
  }
};

const reorderMultDiv = (expr) => {
  if (expr.op === "*" && expr.args.length === 2) {
    const [left, right] = expr.args;
    if (right.value) {
      expr.args = [right, left]; // Swap number in front of letter
    } else if (right.op === "-" && right.args.length === 1) {
      if (right.args[0].value) {
        expr.args = [right, left]; // Swap number in front of letter
      }
    }
  }
  if (expr.op) {
    for (let i = 0; i < expr.args.length; i++) {
      expr.args[i] = reorderMultDiv(expr.args[i]);
    }
  }
  return expr;
};

const expressionToPretty = (expr) => {
  let str = reorderMultDiv(simplifyAndWrapExpr(expr)).toString(STR_OPS);
  str = str.trim();
  // All "operators": [ -/:-@[-`{-~]
  // All letters (including _): [^ -@[-^`{-~]
  // All letters and numbers (including _): [^ -/:-@[-^`{-~]
  const repMid = (m, m1, m2) => m1 + m2;
  const rep2 = (str, re, rep) => {
    str = str.replace(re, rep);
    return str.replace(re, rep);
  };
  // Remove spaces between operators
  str = rep2(str, /([ -/:-@[-`{-~]) +([ -/:-@[-`{-~])/gu, repMid);
  // Remove spaces between operator-letter
  str = rep2(str, /([ -/:-@[-`{-~]) +([^ -/:-@[-`{-~])/gu, repMid);
  // Remove spaces between letter-operator
  str = rep2(str, /([^ -/:-@[-`{-~]) +([ -/:-@[-`{-~])/gu, repMid);
  // Replace spaces between letter-letter with multiply
  str = rep2(
    str,
    /([^ -/:-@[-`{-~]) +([^ -/:-@[-`{-~])/gu,
    (m, m1, m2) => m1 + "*" + m2
  );
  // Remove * or space for implicit multiplication when number-letter or when
  // multiplying with parentheses
  str = str.replace(/([0-9.)]) *\*? *([^ -')-@[-^`{-~])/gu, repMid);
  // Remove unneeded 1
  str = str.replace(/(-)1([^ -@[-^`{-~])/gu, ""); // `
  // Replace with Unicode pi
  str = str.replace(
    /(^|[ -@[-^`{-~])pi([ -@[-^`{-~]|$)/gu,
    (m, m1, m2) => m1 + "π" + m2
  );
  // Remove unneeded multiplication between single letter variable and pi
  str = str.replace(
    /(((([ -@[-^`{-~]|^)[^ -@[-^`{-~])|^)\*)?π/gu,
    (_, _1, m2) => (m2 || "") + "π"
  );
  // Replace with nice cdot symbol
  str = str.replaceAll("*", "·");
  return str;
};

const exprSum = (expr1, expr2) => {
  return `(${expr1.toString(STR_OPS)}) + (${expr2.toString(STR_OPS)})`;
};

const exprDiff = (expr1, expr2) => {
  return `(${expr1.toString(STR_OPS)}) - (${expr2.toString(STR_OPS)})`;
};

export const angleStrSum = (str1, str2) => {
  const expr1 = parse(prettyStrToParsable(str1));
  const expr2 = parse(prettyStrToParsable(str2));
  const sum = simplifyAndWrapExpr(exprSum(expr1, expr2));
  return expressionToPretty(sum);
};

export const angleStrDiff = (str1, str2) => {
  const expr1 = parse(prettyStrToParsable(str1));
  const expr2 = parse(prettyStrToParsable(str2));
  const sum = simplifyAndWrapExpr(exprDiff(expr1, expr2));
  return expressionToPretty(sum);
};

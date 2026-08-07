/**
 * The client half of `/probe`, kept in its own file so that the rule governing
 * it is impossible to miss.
 *
 * **This string is ES3 and must stay ES3.** No `const`, no `let`, no arrow
 * functions, no template literals, no `class`, no shorthand properties — not
 * because the device is guaranteed to lack them, but because a parse error
 * takes the entire script down and reports nothing. The point of the page is
 * to find out which of those the engine has; asking in the question's own
 * vocabulary would answer nothing.
 *
 * For the same reason the modern features are probed through `new Function`
 * rather than written out: that moves the syntax error to runtime, inside a
 * `try`, where it becomes a result instead of a blank section.
 *
 * TypeScript never sees the inside of this string, so it is not type-checked.
 * That is the trade for being able to write pre-ES5 code in a strict ES2023
 * workspace. Keep it short enough to read in one sitting.
 */
export const PROBE_SCRIPT = `
(function () {
  var results = document.getElementById("js-results");
  var status = document.getElementById("js-status");
  if (!results) { return; }

  var rows = [];
  var counter = 0;

  function row(label, value) {
    counter = counter + 1;
    var id = "probe-row-" + counter;
    rows.push('<tr><th>' + label + '</th><td id="' + id + '">' + value + '</td></tr>');
    return id;
  }

  function set(id, value) {
    var el = document.getElementById(id);
    if (el) { el.innerHTML = value; }
  }

  function yesNo(ok) { return ok ? "da" : "nu"; }

  /* Values that can throw on read - localStorage does, in a private or
     storage-disabled context - become a result instead of an early exit. */
  function attempt(fn) {
    try {
      var value = fn();
      return (value === undefined || value === null) ? "-" : String(value);
    } catch (e) {
      return "a aruncat: " + ((e && e.message) ? e.message : "eroare");
    }
  }

  /* Syntax support, without writing the syntax. A parse failure inside
     new Function is a catchable exception; the same code written literally
     would kill the whole script before the first row existed. */
  function syntax(label, source) {
    try { new Function(source); row(label, "da"); }
    catch (e) { row(label, "nu"); }
  }

  function cssProperty(prop, value) {
    try {
      var el = document.createElement("div");
      el.style[prop] = value;
      if (el.style[prop] === value) { return "da"; }
      return el.style[prop] ? "parțial: " + el.style[prop] : "nu";
    } catch (e) { return "nu"; }
  }

  row("navigator.userAgent", attempt(function () { return navigator.userAgent; }));
  row("navigator.platform", attempt(function () { return navigator.platform; }));
  row("screen", attempt(function () { return screen.width + " x " + screen.height; }));
  row("screen.colorDepth", attempt(function () { return screen.colorDepth; }));
  row("window.inner", attempt(function () { return window.innerWidth + " x " + window.innerHeight; }));
  row("documentElement.client", attempt(function () {
    return document.documentElement.clientWidth + " x " + document.documentElement.clientHeight;
  }));
  row("devicePixelRatio", attempt(function () {
    return typeof window.devicePixelRatio === "undefined" ? "absent" : window.devicePixelRatio;
  }));
  row("document.compatMode", attempt(function () { return document.compatMode; }));

  /* A div one CSS inch wide, measured in CSS pixels. The panel is 300ppi, so
     this is what says whether a CSS pixel is a device pixel or half of one -
     which every font size and tap target in the real stylesheet depends on. */
  row("px per CSS inch", attempt(function () {
    var ruler = document.createElement("div");
    ruler.style.width = "1in";
    ruler.style.height = "1px";
    ruler.style.position = "absolute";
    ruler.style.left = "-9999px";
    document.body.appendChild(ruler);
    var width = ruler.offsetWidth;
    document.body.removeChild(ruler);
    return width;
  }));

  row("JSON", yesNo(typeof JSON !== "undefined"));
  row("XMLHttpRequest", yesNo(typeof XMLHttpRequest !== "undefined"));
  row("fetch", yesNo(typeof fetch !== "undefined"));
  row("Promise", yesNo(typeof Promise !== "undefined"));
  row("localStorage", attempt(function () {
    if (typeof localStorage === "undefined") { return "absent"; }
    localStorage.setItem("probe", "1");
    var back = localStorage.getItem("probe");
    localStorage.removeItem("probe");
    return back === "1" ? "da, se poate scrie" : "prezent dar nu scrie";
  }));
  row("sessionStorage", yesNo(typeof sessionStorage !== "undefined"));
  row("addEventListener", yesNo(typeof document.addEventListener !== "undefined"));
  row("querySelectorAll", yesNo(typeof document.querySelectorAll !== "undefined"));
  row("classList", attempt(function () {
    return typeof document.createElement("div").classList === "undefined" ? "nu" : "da";
  }));
  row("Array.forEach", yesNo(typeof Array.prototype.forEach !== "undefined"));
  row("Array.map", yesNo(typeof Array.prototype.map !== "undefined"));
  row("Object.keys", yesNo(typeof Object.keys !== "undefined"));
  row("Function.bind", yesNo(typeof Function.prototype.bind !== "undefined"));
  row("history.pushState", attempt(function () {
    return (window.history && typeof window.history.pushState !== "undefined") ? "da" : "nu";
  }));
  row("FormData", yesNo(typeof FormData !== "undefined"));
  row("matchMedia", yesNo(typeof window.matchMedia !== "undefined"));
  row("inline SVG", attempt(function () {
    if (!document.createElementNS) { return "nu"; }
    var svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    return (svg && typeof svg.createSVGRect === "function") ? "da" : "incert";
  }));

  syntax("sintaxă: let/const", "let a = 1; const b = 2;");
  syntax("sintaxă: funcții săgeată", "var f = function () { return 0; }; var g = eval('(function(){})');");
  syntax("sintaxă: template literal", "var s = \\\`x\\\`;");
  syntax("sintaxă: class", "class A {}");
  syntax("sintaxă: destructurare", "var o = {a: 1}; var {a} = o;");
  syntax("sintaxă: spread", "var a = [1]; var b = [...a];");
  syntax("sintaxă: async/await", "async function f() { await 0; }");

  row("CSS display:flex", cssProperty("display", "flex"));
  row("CSS display:-webkit-box", cssProperty("display", "-webkit-box"));
  row("CSS display:grid", cssProperty("display", "grid"));
  row("CSS position:sticky", cssProperty("position", "sticky"));
  row("CSS border-radius", cssProperty("borderRadius", "12px"));
  row("CSS box-shadow", cssProperty("boxShadow", "3px 3px 0 rgb(0, 0, 0)"));
  row("CSS transform", cssProperty("transform", "translateX(10px)"));
  row("CSS calc()", cssProperty("width", "calc(100% - 10px)"));
  row("CSS variables", attempt(function () {
    var el = document.createElement("div");
    if (!el.style.setProperty) { return "nu"; }
    el.style.setProperty("--probe", "7px");
    return el.style.getPropertyValue("--probe") === "7px" ? "da" : "nu";
  }));
  row("CSS.supports", yesNo(typeof window.CSS !== "undefined" && typeof window.CSS.supports !== "undefined"));

  /* Asynchronous, so the rows go in as pending and are rewritten by the
     callbacks after the table exists. WebP decides whether the covers module
     can stop shipping JPEG to this device. */
  var webpId = row("imagine WebP", "se verifică...");

  results.innerHTML = "<table>" + rows.join("") + "</table>";
  if (status) {
    status.innerHTML = "Scriptul a rulat. Rezultatele sunt mai jos.";
  }

  function imageTest(id, source) {
    try {
      var img = new Image();
      img.onload = function () { set(id, img.width > 0 ? "da (" + img.width + "x" + img.height + ")" : "nu"); };
      img.onerror = function () { set(id, "nu"); };
      img.src = source;
    } catch (e) { set(id, "nu"); }
  }

  imageTest(webpId, "data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==");
})();
`;

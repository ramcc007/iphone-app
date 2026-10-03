// Loads a design-canvas artboard's logic class (design/canvas/*.dc.html) with a fake runtime:
// synchronous setState and captured timers, so tests can tick the clock instantly.
const fs = require('fs');
module.exports = function load(file) {
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  const timers = { intervals: [], timeouts: [] };
  const fakeSetInterval = (fn) => { timers.intervals.push(fn); return timers.intervals.length; };
  const fakeSetTimeout = (fn) => { timers.timeouts.push(fn); return timers.timeouts.length; };
  const factory = new Function('setInterval', 'setTimeout', 'clearInterval', 'clearTimeout',
    "class DCLogic{constructor(p){this.props=p||{};}setState(o){this.state=Object.assign({},this.state,typeof o==='function'?o(this.state):o);}}\n" + m[1] + '\nreturn Component;');
  const C = factory(fakeSetInterval, fakeSetTimeout, () => {}, () => {});
  const make = () => { const c = new C({}); if (c.componentDidMount) c.componentDidMount(); return c; };
  return { make, timers, tickSeconds(n) { for (let i = 0; i < n; i++) timers.intervals.forEach((f) => f()); }, flushTimeouts() { const t = timers.timeouts.splice(0); t.forEach((f) => f()); } };
};

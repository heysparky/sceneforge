# Changeset: scroll-aware edge fade on the character roster

**File:** `Roster Scene Hi-Fi.dc.html`

## Goal
The horizontal character-roster scroller had a single, always-on gradient fade
on its right edge. Make the fade track scroll position instead:

- **At the left end** → no left fade.
- **At the right end** → no right fade.
- **In the middle** → fade both sides.
- **All cards fit (no scrolling possible)** → no fade on either side.

This is a Design Component (`.dc.html`): the template lives between `<x-dc>…</x-dc>`,
and the logic is the `class Component extends DCLogic` block. `React` and `DCLogic`
are injected globally — no imports. Styling is inline only.

---

## 1. Template — add a ref + scroll handler to the scroll container

The scrollable flex row that holds the `<sc-for list="{{ roster }}">` cards.

```diff
- <div style="display:flex;gap:14px;overflow-x:auto;overflow-y:visible;padding:2px 2px 12px;scroll-snap-type:x proximity;">
+ <div ref="{{ scrollRef }}" onScroll="{{ onScroll }}" style="display:flex;gap:14px;overflow-x:auto;overflow-y:visible;padding:2px 2px 12px;scroll-snap-type:x proximity;">
```

## 2. Template — replace the single static right-fade with two dynamic fades

These two divs sit just after the scroll container, inside its
`position:relative` wrapper.

```diff
- <div style="position:absolute;top:0;bottom:12px;right:0;width:48px;background:linear-gradient(to right,transparent,var(--sf-bg,#0b0a13));pointer-events:none;border-radius:0 7px 7px 0;"></div>
+ <div style="{{ fadeLeftStyle }}"></div>
+ <div style="{{ fadeRightStyle }}"></div>
```

## 3. Logic — state, ref, and measurement lifecycle

Extend the `state` initializer and add these members to the `Component` class.
`measureScroll` compares `scrollLeft` against `scrollWidth - clientWidth` to decide
which ends are reached. When all cards fit, `scrollWidth === clientWidth`, so both
`atStart` and `atEnd` are true → both fades hidden. The ResizeObserver + `resize`
listener keep it correct when the layout/theme changes the available width.

```diff
- state = { theme: 'dark', mode: 'lobby', hovered: null, claims: {} };
+ state = { theme: 'dark', mode: 'lobby', hovered: null, claims: {}, atStart: true, atEnd: true };
+
+ scrollRef = React.createRef();
+
+ measureScroll = () => {
+   const el = this.scrollRef.current;
+   if (!el) return;
+   const atStart = el.scrollLeft <= 1;
+   const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
+   if (atStart !== this.state.atStart || atEnd !== this.state.atEnd) {
+     this.setState({ atStart, atEnd });
+   }
+ };
+
+ componentDidMount() {
+   this.measureScroll();
+   this._ro = new ResizeObserver(() => this.measureScroll());
+   if (this.scrollRef.current) this._ro.observe(this.scrollRef.current);
+   window.addEventListener('resize', this.measureScroll);
+ }
+
+ componentDidUpdate() {
+   this.measureScroll();
+ }
+
+ componentWillUnmount() {
+   if (this._ro) this._ro.disconnect();
+   window.removeEventListener('resize', this.measureScroll);
+ }
```

## 4. Logic — compute the fade styles in `renderVals()`

Add just before the `return {` in `renderVals()`:

```js
const fadeBase = (side) => `position:absolute;top:0;bottom:12px;${side}:0;width:48px;pointer-events:none;transition:opacity .18s ease;background:linear-gradient(to ${side === 'left' ? 'right' : 'left'},var(--sf-bg,#0b0a13),transparent);border-radius:${side === 'left' ? '7px 0 0 7px' : '0 7px 7px 0'};`;
const fadeLeftStyle  = fadeBase('left')  + `opacity:${this.state.atStart ? 0 : 1};`;
const fadeRightStyle = fadeBase('right') + `opacity:${this.state.atEnd ? 0 : 1};`;
```

Then expose them in the returned object:

```diff
  return {
-   roster, windowVars,
+   roster, windowVars, fadeLeftStyle, fadeRightStyle,
+   scrollRef: this.scrollRef,
+   onScroll: this.measureScroll,
    ...
```

---

## Notes
- Fades cross-fade via `transition:opacity .18s ease`.
- `pointer-events:none` keeps the fades from intercepting clicks/drags on cards.
- The fade color uses the themed `--sf-bg` variable, so it stays correct across the
  Dark / Fantasy / Sci-Fi / Light themes.

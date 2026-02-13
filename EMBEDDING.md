# Embedding in Squarespace

Instructions for embedding the manuscript viewers in a Squarespace site using Code Blocks.

## 1956 Expedition

**URL:** https://davidgedye.github.io/hoyte/1956expedition/

**Squarespace Code Block:**
```html
<iframe
  src="https://davidgedye.github.io/hoyte/1956expedition/"
  style="width:100vw; height:80vh; border:none; margin-left:calc(-50vw + 50%); display:block;">
</iframe>
```

## Notes

- The `width:100vw` and `margin-left:calc(-50vw + 50%)` trick makes the iframe break out of Squarespace's narrow content container to full viewport width.
- Adjust `height:80vh` as needed (80% of viewport height).
- The viewer automatically hides the full-screen button when embedded (it doesn't work in iframes anyway).
- If the iframe doesn't break out of the container, add this to **Design > Custom CSS** in Squarespace:
  ```css
  .code-block {
    overflow: visible !important;
  }
  ```

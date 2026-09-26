# Static neutral review gallery

`review.html`, `review.js` and `review.css` consume the adjacent, parent-generated `review-manifest.json`. No data, arm mapping, production route or product link is supplied by these files. Serve them over the same local HTTP origin as the images; opening an HTML file directly is not supported by fetch.

The gallery shows three uncropped, neutral-labeled views, a quiet/speech switch, one common action-time slider, sampled-frame buttons, numeric endpoint jumps, and 15 Hz playback. Native 60 Hz simulation, 15 Hz PNG sampling, additional marked moments and absence of audio are stated on the page. Playback selects the latest sample at or before the common monotonic action time; it does not increment one sample per tick, so extra endpoints do not stretch the clip. If requested images are not ready, buffering time is excluded from that clock. All three image nodes must decode before a frame is replaced. Upcoming samples use a bounded 24-entry cache and visible preload/decode errors; playback pauses on loading failure. A narrow screen gets a horizontal three-view strip rather than cropped figures. No autoplay runs; backgrounding pauses playback.

Schema validation requires the two named groups, three unique `View 1`/`View 2`/`View 3` labels, strictly increasing steps/times, complete matching image lists and same-origin image URLs. Only textContent and DOM node creation render manifest labels. The gallery never imports the experiment, production avatar code, or hidden mapping.

The real local gallery passes three focused browser groups with five ordinary desktop/mobile
plates in `gallery-native-v2/`: common playback advances matched times and pause retains them;
quiet/speech switching, endpoint jumps and keyboard frame controls work; all image nodes remain
uncropped, with only the contained three-column strip scrolling horizontally on mobile. Browser
errors are empty and the five selected gallery source/manifest hashes stay exact. The final
layout uses each PNG's intrinsic aspect ratio. `gallery-native-v1/` retains the first passing
functional capture and its exact five source files before unnecessary fixed-ratio letterboxing
was removed; its old layout is not represented as the final layout.

These checks establish the implemented controls and inspected frames. They do not certify a
sustained delivery rate of 15 images per second on every device. Sampling is 15Hz with additional
endpoints; browser playback uses the time-based policy above and can skip frames or buffer.

```sh
node --check docs/evidence/nonhair-2026-09-26/expression-next/review.js
```

import assert from "node:assert/strict";
import test from "node:test";

const {carouselSwipeStep}=await import("../app/carousel-swipe.ts");

test("left and right carousel swipes require deliberate horizontal movement",()=>{
  assert.equal(carouselSwipeStep(-80,5),1);
  assert.equal(carouselSwipeStep(80,5),-1);
  assert.equal(carouselSwipeStep(-30,2),0);
  assert.equal(carouselSwipeStep(70,90),0);
  assert.equal(carouselSwipeStep(-54,0),1);
});

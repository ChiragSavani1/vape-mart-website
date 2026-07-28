export function carouselSwipeStep(deltaX:number,deltaY:number,threshold=54) {
  if(Math.abs(deltaX)<threshold||Math.abs(deltaX)<=Math.abs(deltaY)*1.15)return 0;
  return deltaX<0?1:-1;
}

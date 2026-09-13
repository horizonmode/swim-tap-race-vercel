import human from './human.js';
import woman from './woman.js';
import esme from './esme.js';
import cat from './cat.js';
import cat_bw from './cat-bw.js';
import dog from './dog.js';
import frog from './frog.js';
import duck from './duck.js';
import { normalizeSwimmer } from "../../swimmers.js";

const sprites = {
  'human': human,
  'woman': woman,
  'esme': esme,
  'cat': cat,
  'cat-bw': cat_bw,
  'dog': dog,
  'frog': frog,
  'duck': duck,
};

export function swimmerMarkup(value) {
  return sprites[normalizeSwimmer(value)];
}

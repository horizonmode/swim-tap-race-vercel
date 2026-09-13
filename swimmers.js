// Character identifiers shared by the server and picker; sprite assets stay client-side.
export const swimmerOptions = [
  {
    "id": "human",
    "name": "Man"
  },
  {
    "id": "woman",
    "name": "Woman"
  },
  {
    "id": "esme",
    "name": "Esme"
  },
  {
    "id": "cat",
    "name": "Cat"
  },
  {
    "id": "cat-bw",
    "name": "Cat 2"
  },
  {
    "id": "dog",
    "name": "Dog"
  },
  {
    "id": "frog",
    "name": "Frog"
  },
  {
    "id": "duck",
    "name": "Duck"
  }
];

export function normalizeSwimmer(value) {
  return swimmerOptions.some(option => option.id === value) ? value : "human";
}

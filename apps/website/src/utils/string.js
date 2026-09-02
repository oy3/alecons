export function toTitleCase(value = "") {
  return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}

// data/balance.js — economic and gameplay balance constants

// Rate at which hunger decreases per second (100 hunger per in-game year)
export const HUNGER_RATE = 100 / 60;

// Approximate amount of food an adult needs per day.
// Based on hunger decay and average food value (about 20 hunger per unit).
export const DAILY_FOOD_NEED = (HUNGER_RATE * 60) / (365 * 20);

// Threshold of days of food supply considered low
export const LOW_FOOD_DAYS = 30;

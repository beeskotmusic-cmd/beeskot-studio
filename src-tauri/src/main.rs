// pas de fenêtre noire de console sous Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
fn main() { beeskot_studio_lib::run() }

// AlgoTrade OS - Module System
// Plugin benzeri modül sistemi - her özellik bir modül olarak çalışır

pub mod traits;
pub mod stop_loss;
pub mod risk_calculator;

pub use traits::TradingModule;

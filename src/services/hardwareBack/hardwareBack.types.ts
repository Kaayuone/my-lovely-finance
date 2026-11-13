export type HardwareBackHandlerOptions = {
  priority: number;
  isActive: () => boolean;
  onBack: () => void;
};

export type HardwareBackHandler = HardwareBackHandlerOptions & {
  id: symbol;
};

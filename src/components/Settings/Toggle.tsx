import React from "react";
import { Switch } from "antd";

const Toggle: React.FC<{
  on: boolean;
  onChange: () => void;
  accentColor: string;
}> = ({ on, onChange, accentColor }) => (
  <Switch
    checked={on}
    size="small"
    onChange={() => onChange()}
    style={{ backgroundColor: on ? accentColor : undefined }}
  />
);

export default Toggle;

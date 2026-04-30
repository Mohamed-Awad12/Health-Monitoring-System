import { useContext } from "react";
import { ConfirmContext } from "../context/ConfirmContext";

export function useConfirm() {
  const { confirm } = useContext(ConfirmContext);
  return confirm;
}

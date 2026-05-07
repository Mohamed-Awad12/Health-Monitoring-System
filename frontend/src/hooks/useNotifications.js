import { useContext } from "react";
import { NotificationsContext } from "../context/NotificationsContext";

export const useNotifications = () => useContext(NotificationsContext);

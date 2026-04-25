export const getRoleHomePath = (role) => {
  if (role === "admin") {
    return "/admin";
  }

  if (role === "doctor") {
    return "/doctor";
  }

  return "/patient";
};

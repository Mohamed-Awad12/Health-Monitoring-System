const patientScopeTag = (patientId) => `patient:${patientId}`;
const doctorScopeTag = (doctorId) => `doctor:${doctorId}`;
const adminUsersTag = "admin:users";
const doctorDirectoryTag = "directory:doctors";

module.exports = {
  adminUsersTag,
  doctorDirectoryTag,
  patientScopeTag,
  doctorScopeTag,
};

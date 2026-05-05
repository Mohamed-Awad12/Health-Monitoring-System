const fs = require("fs/promises");
const path = require("path");
const { ROLES } = require("../constants/roles");
const {
  adminUsersTag,
  doctorDirectoryTag,
  doctorScopeTag,
  patientScopeTag,
} = require("./cacheTags");
const Alert = require("../models/Alert");
const Device = require("../models/Device");
const DoctorPatient = require("../models/DoctorPatient");
const Reading = require("../models/Reading");
const responseCache = require("./responseCache");
const User = require("../models/User");

const removeDoctorVerificationDocument = async (documentFileName) => {
  if (!documentFileName) {
    return;
  }

  const { doctorVerificationDir } = require("../middlewares/upload");
  const safeName = path.basename(documentFileName);

  try {
    await fs.unlink(path.join(doctorVerificationDir, safeName));
  } catch (_error) {}
};

const deleteUserAccount = async (user) => {
  if (!user) {
    return null;
  }

  const userId = user._id;
  const invalidationTags = [adminUsersTag, doctorDirectoryTag];
  let relatedDoctorIds = [];
  let relatedPatientIds = [];

  if (user.role === ROLES.PATIENT) {
    relatedDoctorIds = await DoctorPatient.distinct("doctor", { patient: userId });
  }

  if (user.role === ROLES.DOCTOR) {
    relatedPatientIds = await DoctorPatient.distinct("patient", { doctor: userId });
  }

  const cleanupOperations = [
    Alert.updateMany(
      { acknowledgedBy: userId },
      { $set: { acknowledgedBy: null } }
    ),
    User.updateMany(
      { "doctorVerification.reviewedBy": userId },
      { $unset: { "doctorVerification.reviewedBy": "" } }
    ),
  ];

  if (user.role === ROLES.PATIENT) {
    cleanupOperations.push(
      Alert.deleteMany({ patient: userId }),
      Reading.deleteMany({ patient: userId }),
      DoctorPatient.deleteMany({ patient: userId }),
      Device.updateMany(
        { patient: userId },
        {
          $set: {
            patient: null,
            lastSeenAt: null,
          },
          $unset: {
            label: "",
          },
        }
      )
    );
  }

  if (user.role === ROLES.DOCTOR) {
    cleanupOperations.push(DoctorPatient.deleteMany({ doctor: userId }));
  }

  await Promise.all(cleanupOperations);
  await user.deleteOne();
  await removeDoctorVerificationDocument(user.doctorVerification?.documentFileName);

  if (user.role === ROLES.PATIENT) {
    invalidationTags.push(
      patientScopeTag(userId),
      ...relatedDoctorIds.map((doctorId) => doctorScopeTag(doctorId))
    );
  }

  if (user.role === ROLES.DOCTOR) {
    invalidationTags.push(
      doctorScopeTag(userId),
      ...relatedPatientIds.map((patientId) => patientScopeTag(patientId))
    );
  }

  responseCache.invalidateByTags(invalidationTags);

  return user;
};

module.exports = {
  deleteUserAccount,
};

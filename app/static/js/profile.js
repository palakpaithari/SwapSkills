document.addEventListener('DOMContentLoaded', () => {
    loadSkills();
    document.getElementById('avatar-upload')?.addEventListener('change', uploadAvatar);
    document.getElementById('profile-form')?.addEventListener('submit', handleProfileSubmit);
});

// ===============
// Load Skills
// ===============
function loadSkills() {
    const userDataElement = document.getElementById('user-data');
    if (!userDataElement) return;

    try {
        const userData = JSON.parse(userDataElement.dataset.user || '{}');

        if (userData.skillsOffered) {
            userData.skillsOffered.forEach(skill => addSkillToDOM('offered', skill));
        }

        if (userData.skillsWanted) {
            userData.skillsWanted.forEach(skill => addSkillToDOM('wanted', skill));
        }
    } catch (error) {
        console.error("Error loading skills:", error);
    }
}

// ===============
// Add/Remove Skill Tags
// ===============
function addSkill(type) {
    const input = document.getElementById(`new-skill-${type}`);
    const skill = input.value.trim();
    if (skill) {
        addSkillToDOM(type, skill);
        input.value = '';
    }
}

function addSkillToDOM(type, skill) {
    const container = document.getElementById(`skills-${type}-container`);
    if (!container) return;

    const pill = document.createElement('div');
    pill.className = 'flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full';
    pill.innerHTML = `
        ${skill}
        <button type="button" onclick="removeSkill(this)" 
                class="ml-2 text-blue-500 hover:text-blue-700">×</button>
        <input type="hidden" name="skills${type.charAt(0).toUpperCase() + type.slice(1)}[]" value="${skill}">
    `;
    container.appendChild(pill);
}

function removeSkill(button) {
    button.parentElement.remove();
}

// ===============
// Avatar Upload
// ===============
async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const avatarImg = document.getElementById('profile-avatar');
        avatarImg.src = URL.createObjectURL(file);

        const storageRef = firebase.storage().ref();
        const fileRef = storageRef.child(`avatars/${firebase.auth().currentUser.uid}`);
        await fileRef.put(file);

        const photoURL = await fileRef.getDownloadURL();
        avatarImg.src = photoURL;

        await firebase.auth().currentUser.updateProfile({ photoURL });
        await updateProfile({ photoURL }); // Optional backend sync

    } catch (error) {
        console.error("Upload failed:", error);
        alert("Error uploading image");
    }
}

// ===============
// Save Profile to Flask API
// ===============
async function handleProfileSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const data = {
        displayName: formData.get('displayName'),
        location: formData.get('location'),
        public: form.querySelector('#public').checked,
        availability: Array.from(form.querySelectorAll('input[name="availability"]:checked')).map(el => el.value),
        skillsOffered: Array.from(document.querySelectorAll('#skills-offered-container input')).map(el => el.value),
        skillsWanted: Array.from(document.querySelectorAll('#skills-wanted-container input')).map(el => el.value)
    };

    try {
        const token = await firebase.auth().currentUser.getIdToken();
        const user = firebase.auth().currentUser;

        // Update Firebase auth profile
        await user.updateProfile({
            displayName: data.displayName
        });

        // Update in Firestore
        const response = await fetch('/api/profile', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        if (result.success) {
            alert("Profile updated successfully!");
            window.location.href = '/';
        } else {
            throw new Error(result.error || 'Failed to update profile');
        }
    } catch (error) {
        console.error("Error updating profile:", error);
        alert("Error saving profile: " + error.message);
    }
}

// Optional backend sync for photoURL only
async function updateProfile(updateData) {
    try {
        const token = await firebase.auth().currentUser.getIdToken();
        await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updateData)
        });
    } catch (err) {
        console.error("Error syncing profile:", err);
    }
}

// Expose functions to global window (for HTML button onclick)
window.addSkill = addSkill;
window.removeSkill = removeSkill;

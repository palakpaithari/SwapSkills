document.addEventListener('DOMContentLoaded', function() {
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    // DOM Elements
    const usersContainer = document.getElementById('users-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const noResults = document.getElementById('no-results');
    const searchInput = document.getElementById('search-input');
    const availabilityFilter = document.getElementById('availability-filter');
    const searchButton = document.getElementById('search-button');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const currentPageSpan = document.getElementById('current-page');
    
    // Pagination
    let currentPage = 1;
    const usersPerPage = 8;
    let lastVisibleDoc = null;
    let hasMoreUsers = true;
    
    // Initial load
    fetchUsers();
    
    // Search functionality
    searchButton.addEventListener('click', () => {
        currentPage = 1;
        lastVisibleDoc = null;
        fetchUsers();
    });
    
    // Pagination controls
    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchUsers();
        }
    });
    
    nextPageButton.addEventListener('click', () => {
        if (hasMoreUsers) {
            currentPage++;
            fetchUsers();
        }
    });
    
    async function fetchUsers() {
        try {
            // Show loading state
            loadingSpinner.classList.remove('hidden');
            usersContainer.classList.add('hidden');
            noResults.classList.add('hidden');
            
            // Build query
            let query = db.collection('users')
                .where('public', '==', true)
                .orderBy('createdAt', 'desc')
                .limit(usersPerPage);
            
            // Apply search filter
            const searchTerm = searchInput.value.toLowerCase();
            if (searchTerm) {
                query = query.where('skillsOffered', 'array-contains', searchTerm);
            }
            
            // Apply availability filter
            const availability = availabilityFilter.value;
            if (availability) {
                query = query.where('availability', 'array-contains', availability);
            }
            
            // Pagination
            if (currentPage > 1 && lastVisibleDoc) {
                query = query.startAfter(lastVisibleDoc);
            }
            
            // Execute query
            const snapshot = await query.get();
            
            // Update pagination tracking
            if (snapshot.docs.length > 0) {
                lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
                hasMoreUsers = snapshot.docs.length === usersPerPage;
            } else {
                hasMoreUsers = false;
            }
            
            // Update UI
            if (snapshot.empty) {
                noResults.classList.remove('hidden');
            } else {
                usersContainer.innerHTML = '';
                snapshot.forEach(doc => {
                    usersContainer.appendChild(createUserCard(doc.data(), doc.id));
                });
                usersContainer.classList.remove('hidden');
            }
            
            // Update pagination UI
            currentPageSpan.textContent = currentPage;
            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = !hasMoreUsers;
            
        } catch (error) {
            console.error("Error fetching users:", error);
            alert("Error loading users. Please try again.");
        } finally {
            loadingSpinner.classList.add('hidden');
        }
    }
    
    function createUserCard(user, userId) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-lg shadow overflow-hidden transition transform hover:scale-[1.02]';
        
        card.innerHTML = `
            <div class="p-4">
                <div class="flex items-center mb-3">
                    <img src="${user.photoURL || '/static/images/default-avatar.png'}" 
                         alt="${user.displayName}" 
                         class="w-12 h-12 rounded-full object-cover mr-3">
                    <div>
                        <h3 class="font-semibold text-gray-800">${user.displayName}</h3>
                        ${user.location ? `<p class="text-sm text-gray-500">${user.location}</p>` : ''}
                    </div>
                </div>
                
                <div class="mb-3">
                    <h4 class="text-sm font-medium text-gray-700 mb-1">Offers:</h4>
                    <div class="flex flex-wrap gap-1">
                        ${user.skillsOffered?.map(skill => 
                            `<span class="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                ${skill}
                            </span>`).join('') || '<span class="text-gray-400 text-xs">None listed</span>'}
                    </div>
                </div>
                
                <div class="mb-4">
                    <h4 class="text-sm font-medium text-gray-700 mb-1">Wants:</h4>
                    <div class="flex flex-wrap gap-1">
                        ${user.skillsWanted?.map(skill => 
                            `<span class="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                                ${skill}
                            </span>`).join('') || '<span class="text-gray-400 text-xs">None listed</span>'}
                    </div>
                </div>
                
                <a href="/user/${userId}" 
                   class="block w-full bg-blue-600 hover:bg-blue-700 text-white text-center py-2 rounded transition">
                    View Profile
                </a>
            </div>
        `;
        
        return card;
    }
});

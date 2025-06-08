import styles from "./Modal.module.css"

import { useState, useEffect, use } from 'react';

function Modal({ isModalOpen, setIsModalOpen, users, myUser }) {
    const [editingUser, setEditingUser] = useState(null);
    const [noMasterFound, setNoMasterFound] = useState(true);
    const [isUserAllowedToEdit, setIsUserAllowedToEdit] = useState(false);
    const [nicknameToSet, setNicknameToSet] = useState("");

    // Effect to set the user being edited when modal opens
        useEffect(() => {
            if (isModalOpen && users) {
                const userToEdit = users.find(user => user.ip === isModalOpen);
                setEditingUser(userToEdit);
                setNoMasterFound(!users.some(user => user.role === 'master'));
                setIsUserAllowedToEdit(myUser && myUser.role === 'master');
            } else {
                setEditingUser(null);
            }
        }, [isModalOpen, users]);

    // API functions
        const changeUserRole = async (userIP, newRole) => {
            try {
                const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';
                const response = await fetch(`${websocketUrl}/set-user-role`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ip: userIP,
                        role: newRole
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    console.log('Role updated successfully:', data.message);
                    return { success: true, message: data.message };
                } else {
                    console.error('Failed to update role:', data.message);
                    return { success: false, message: data.message };
                }
            } catch (error) {
                console.error('Error updating user role:', error);
                return { success: false, message: 'Network error occurred' };
            }
        };

        const changeUserNickname = async (userIP, newNickname) => {
            try {
                const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';
                const response = await fetch(`${websocketUrl}/set-user-nickname`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ip: userIP,
                        nickname: newNickname
                    })
                });

                const data = await response.json();

                if (response.ok) {
                    console.log('Nickname updated successfully:', data.message);
                    return { success: true, message: data.message };
                } else {
                    console.error('Failed to update nickname:', data.message);
                    return { success: false, message: data.message };
                }
            } catch (error) {
                console.error('Error updating user nickname:', error);
                return { success: false, message: 'Network error occurred' };
            }
        };

    // Handle button presses
        const handleClose = () => {
            setIsModalOpen(null);
        }

        const handleClaimMasterRole = () => {
            if (editingUser) {
                const websocketUrl = import.meta.env.VITE_WEBSOCKET_URL || 'http://localhost:3000';
                const requestUrl = `${websocketUrl}/claim-master`;
                console.log("url: ", requestUrl);

                fetch(requestUrl, {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'You are now the master') {
                        // Update the users list or state as needed
                        setIsModalOpen(null); // Close the modal after claiming
                    } else {
                        console.error('Failed to claim master role:', data.message);
                    }
                })
                .catch(error => {
                    console.error('Error claiming master role:', error);
                });
            }
        }

        const handleSetRole = async (role) => {
            if (editingUser) {
                console.log(`Setting role for ${editingUser.username} to ${role}`);
                const result = await changeUserRole(editingUser.ip, role);
            }
        }

        const handleSetNickname = async () => {
            if (editingUser && nicknameToSet.trim()) {
                const ip_of_user_to_edit = editingUser.ip;
                console.log(`Setting nickname for ${editingUser.username} to ${nicknameToSet}`);
                
                const result = await changeUserNickname(ip_of_user_to_edit, nicknameToSet.trim());
            } else {
                alert('Please enter a valid nickname');
            }
        };

    // Render the modal dialog
        return (
            <>
                {isModalOpen && (
                    <div className={styles.modalOverlay}>
                        <div className={styles.modalCard}>
                            {editingUser?.ip &&
                                <div>
                                    <h1>Editing: {editingUser.username} [{editingUser.role}]</h1>

                                    {noMasterFound && (
                                        <div className={styles.claimMasterStyle}>
                                            <p> No master found. Please claim the master role. </p>
                                            <button className={styles.claimMasterRoleButton} onClick={handleClaimMasterRole}> Claim Master Role </button>
                                        </div>
                                    )}

                                    {!noMasterFound && (
                                        <>
                                            {isUserAllowedToEdit &&
                                                <div>
                                                    <p> Edit the user as you wish. </p>

                                                    <div className={styles.setRoleContainer}>
                                                        <p> Set User Role: </p>
                                                        <button onClick={() => handleSetRole("guest")}> Guest </button>
                                                        <button onClick={() => handleSetRole("bottom")}> Bottom </button>
                                                    </div>

                                                    <div className={styles.setNicknameContainer}>
                                                        <p> Nick: </p>
                                                        <input 
                                                            type="text" 
                                                            placeholder="Enter new nickname" 
                                                            value={nicknameToSet}
                                                            onChange={(e) => setNicknameToSet(e.target.value)}
                                                        />
                                                        <button onClick={handleSetNickname}> Set nickname </button>
                                                    </div>
                                                </div>
                                            }
                                            {!isUserAllowedToEdit && (
                                                <div>
                                                    <p> You cannot edit users </p>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    <button className={styles.closeButton} onClick={handleClose}>Close</button>
                                </div>
                            }
                        </div>
                    </div>
                )}
            </>
        )
}

export default Modal;
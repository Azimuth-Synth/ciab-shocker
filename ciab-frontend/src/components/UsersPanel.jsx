// UsersPanel.jsx
import { useEffect } from 'react';

import styles from './UsersPanel.module.css';

function UsersPanel({ users = [], myUser, setIsModalOpen, userCommands = { start: [], stop: [] } }) {
    const getStatusStyle = (status) => {
        switch (status) {
            case 'online':
                return styles.statusOnline;
            case 'offline':
                return styles.statusOffline;
            default:
                return {};
        }
    };

    const getUserCommandStatus = (userIp) => {
        if (userCommands.start.includes(userIp)) {
            return 'running';
        } else if (userCommands.stop.includes(userIp)) {
            return 'stopped';
        }
        return 'none';
    };

    const getCommandStatusStyle = (commandStatus) => {
        switch (commandStatus) {
            case 'running':
                return styles.commandRunning;
            case 'stopped':
                return styles.commandStopped;
            default:
                return {};
        }
    };

    const handleControl = (userIp, userNick) => {
        setIsModalOpen(userIp);
    };

    // Sort users to show online users first
    const sortedUsers = [...users].sort((a, b) => {
        if (a.status === 'online' && b.status !== 'online') return -1;
        if (b.status === 'online' && a.status !== 'online') return 1;
        return 0; // Keep original order for users with same status
    });

    return (
        <>
            <div className={styles.container}>
                <div className={styles.card}>
                    {myUser?.role && myUser?.nickname && <p> Welcome, {myUser.role} {myUser.nickname}! </p>}

                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th className={styles.th}>Username</th>
                                <th className={styles.th}>Role</th>
                                <th className={styles.th}>Status</th>
                                {/* <th className={styles.th}>Command</th> */}
                                <th className={styles.th}>Controls</th>
                            </tr>
                        </thead>

                        <tbody>
                            {sortedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className={styles.td} style={{ textAlign: 'center' }}>
                                        No users connected
                                    </td>
                                </tr>
                            ) : (
                                sortedUsers.map((user) => {
                                    const commandStatus = getUserCommandStatus(user.ip);
                                    return (
                                        <tr key={user.ip} className={
                                            commandStatus === 'running' ? styles.userRunning : 
                                            commandStatus === 'stopped' ? styles.userStopped : ''
                                        }>
                                            <td className={styles.td}>
                                                {user.username}
                                            </td>

                                            <td className={styles.td}>
                                                    {user.role}
                                            </td>

                                            <td className={`${styles.td} ${getStatusStyle(user.status)}`}>
                                                {user.status}
                                            </td>

                                            <td className={styles.td} style={{ textAlign: 'center' }}>
                                                <button 
                                                    className={styles.controlButton}
                                                    onClick={() => handleControl(user.ip)}
                                                > 
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>

                </div>
            </div>
        </>
    );
}

export default UsersPanel;
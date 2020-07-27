const functions = require('firebase-functions');

const app = require('express')();

const FBAuth = require('./util/fbAuth');

const cors = require('cors');
app.use(cors());

const { db } = require('./util/admin');

const {
    getAllScreams, 
    postOneScream, 
    getScream, 
    commentOnScream,
    likeScream,
    unlikeScream,
    deleteScream
} = require('./handlers/screams');
const {
    signup,
    login,
    uploadImage,
    addUserDetails,
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead
} = require('./handlers/users');

//Scream Routes
app.get('/screams', getAllScreams);
app.post('/screams', FBAuth, postOneScream);
app.get('/scream/:screamId', getScream);
app.get('/scream/:screamId/like', FBAuth, likeScream);
app.get('/scream/:screamId/unlike', FBAuth, unlikeScream);
app.post('/scream/:screamId/comment', FBAuth, commentOnScream);
app.delete('/scream/:screamId', FBAuth, deleteScream);

//Users Routes
app.post('/signup', signup);
app.post('/login', login);
app.post('/users/image', FBAuth, uploadImage);
app.post('/users', FBAuth, addUserDetails);
app.get('/users', FBAuth, getAuthenticatedUser);
app.get('/users/:handle', getUserDetails);
app.post('/notifications', markNotificationsRead);

exports.api = functions.https.onRequest(app); //turns into multiple routes 

exports.createNotificationOnLike = functions.firestore.document('likes/{id}') //not an api endpoint so doesn't need a route like above 
    .onCreate(snapshot => {
       return db.doc(`/screams/${snapshot.data().screamId}`).get()
            .then(doc => {
                if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'like',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .catch(err => {
                console.error(err);
                return;
            })
    });

exports.deleteNotificationOnUnlike = functions.firestore.document('likes/{id}')
    .onDelete(snapshot => {
        return db.doc(`/notifications/${snapshot.id}`)
            .delete()
            .catch(err => {
                console.error(err);
                return;
            })
    })

exports.createNotificationOnComment = functions.firestore.document('comments/{id}')
    .onCreate(snapshot => {
        return db.doc(`/screams/${snapshot.data().screamId}`).get()
            .then(doc => {
                if(doc.exists && doc.data().userHandle !== snapshot.data().userHandle){
                    return db.doc(`/notifications/${snapshot.id}`).set({
                        createdAt: new Date().toISOString(),
                        recipient: doc.data().userHandle,
                        sender: snapshot.data().userHandle,
                        type: 'comment',
                        read: false,
                        screamId: doc.id
                    });
                }
            })
            .catch(err => {
                console.error(err)
                return; //dont need to return anything because it is a database trigger not an api endpoint
            })
    });

exports.onUserImageChange = functions.firestore.document('users/{userId}')
    .onUpdate(change => {
        if(change.before.data().imageUrl !== change.after.data().imageUrl){
            const batch = db.batch();
        return db.collection('screams').where('userHandle', '==', change.before.data().handle).get()
            .then(data => {
                data.forEach(doc => {
                    const scream = db.doc(`/screams/${doc.id}`);
                    batch.update(scream, {userImage: change.after.data().imageUrl});
                })  
                return batch.commit();
            })
        }
        else{
            return true;
        }
    })

    exports.onScreamDelete = functions
    .region('europe-west1')
    .firestore.document('/screams/{screamId}')
    .onDelete((snapshot, context) => {
      const screamId = context.params.screamId;
      const batch = db.batch();
      return db
        .collection('comments')
        .where('screamId', '==', screamId)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            batch.delete(db.doc(`/comments/${doc.id}`));
          });
          return db
            .collection('likes')
            .where('screamId', '==', screamId)
            .get();
        })
        .then((data) => {
          data.forEach((doc) => {
            batch.delete(db.doc(`/likes/${doc.id}`));
          });
          return db
            .collection('notifications')
            .where('screamId', '==', screamId)
            .get();
        })
        .then((data) => {
          data.forEach((doc) => {
            batch.delete(db.doc(`/notifications/${doc.id}`));
          });
          return batch.commit();
        })
        .catch((err) => console.error(err));
    });



/**
 * GENERAL NOTES
 * APIs are just way for two programs to interact to this exchange of information(adding to database) has a URL for a request 
 * firebase serve instead of deploy does things locally do it makes it faster for testing, uses localhost
 * Need to set google credentials every terminal session
 */

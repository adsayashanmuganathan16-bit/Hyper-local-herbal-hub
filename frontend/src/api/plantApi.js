import api from './axios';

export const plantApi = {
  identify: (image) => {
    const formData = new FormData();
    formData.append('image', image);

    // Axios sets the multipart boundary automatically when FormData is used.
    return api.post('/api/plants/identify', formData);
  },
};

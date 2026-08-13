package iuh.fit.account_service.dto.user;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PastOrPresent;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public class UpdateUserProfileRequest {

    @NotBlank(message = "Full name is required")
    @Size(max = 100, message = "Full name must not exceed 100 characters")
    private String fullName;

    @Pattern(
            regexp = "^(\\+?[0-9]{8,15})?$",
            message = "Phone must contain 8 to 15 digits and may start with +"
    )
    private String phone;

    @PastOrPresent(message = "Date of birth must not be in the future")
    private LocalDate dateOfBirth;

    @Size(max = 30, message = "Gender must not exceed 30 characters")
    private String gender;

    @Size(max = 30, message = "Province code must not exceed 30 characters")
    private String provinceCode;

    @Size(max = 100, message = "Province must not exceed 100 characters")
    private String province;

    @Size(max = 40, message = "Commune code must not exceed 40 characters")
    private String communeCode;

    @Size(max = 160, message = "Commune must not exceed 160 characters")
    private String commune;

    @Size(max = 100, message = "District must not exceed 100 characters")
    private String district;

    @Size(max = 100, message = "Ward must not exceed 100 characters")
    private String ward;

    @Size(max = 255, message = "Address detail must not exceed 255 characters")
    private String addressDetail;

    @Size(max = 300, message = "Bio must not exceed 300 characters")
    private String bio;

    public String getFullName() {
        return fullName;
    }

    public void setFullName(String fullName) {
        this.fullName = fullName;
    }

    public String getPhone() {
        return phone;
    }

    public void setPhone(String phone) {
        this.phone = phone;
    }

    public LocalDate getDateOfBirth() {
        return dateOfBirth;
    }

    public void setDateOfBirth(LocalDate dateOfBirth) {
        this.dateOfBirth = dateOfBirth;
    }

    public String getGender() {
        return gender;
    }

    public void setGender(String gender) {
        this.gender = gender;
    }

    public String getProvince() {
        return province;
    }

    public String getProvinceCode() {
        return provinceCode;
    }

    public void setProvinceCode(String provinceCode) {
        this.provinceCode = provinceCode;
    }

    public void setProvince(String province) {
        this.province = province;
    }

    public String getCommuneCode() {
        return communeCode;
    }

    public void setCommuneCode(String communeCode) {
        this.communeCode = communeCode;
    }

    public String getCommune() {
        return commune;
    }

    public void setCommune(String commune) {
        this.commune = commune;
    }

    public String getDistrict() {
        return district;
    }

    public void setDistrict(String district) {
        this.district = district;
    }

    public String getWard() {
        return ward;
    }

    public void setWard(String ward) {
        this.ward = ward;
    }

    public String getAddressDetail() {
        return addressDetail;
    }

    public void setAddressDetail(String addressDetail) {
        this.addressDetail = addressDetail;
    }

    public String getBio() {
        return bio;
    }

    public void setBio(String bio) {
        this.bio = bio;
    }
}
